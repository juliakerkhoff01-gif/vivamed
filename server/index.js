// server/index.js (ESM)
// Start lokal:   OPENAI_API_KEY=... npm run dev
// Render/Prod:   setzt PORT automatisch, OPENAI_API_KEY in Render Env setzen

import express from "express";
import cors from "cors";
import { buildEscalationLine } from "./escalations.js";

const app = express();

// ✅ wichtig für Expo Go / iPhone
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const HOST = "0.0.0.0";

// --- Root (damit die Render-URL ohne /health nicht "Error" zeigt) ---
app.get("/", (_req, res) => {
  res.redirect("/health");
});

// --- Health ---
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "vivamed-server",
    port: PORT,
    time: new Date().toISOString(),
    env: process.env.RENDER ? "render" : "local",
  });
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function difficultyTier(d) {
  const x = clamp(Number(d ?? 65), 0, 100);
  if (x >= 85) return "veryHigh";
  if (x >= 70) return "high";
  if (x >= 45) return "mid";
  return "low";
}

// --- Helpers: robust JSON extraction for feedback-report ---
function extractJsonObject(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;

  // 1) Direct parse
  try {
    return JSON.parse(s);
  } catch {}

  // 2) Try to extract first {...} block
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }

  return null;
}

function pickExaminerPersona({ tone, difficulty, examinerProfile }) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);
  const t = String(tone ?? "neutral");

  const base = [
    { id: "coach_helpful", w: d < 45 ? 28 : d < 70 ? 18 : 8 },
    { id: "neutral_structured", w: d < 45 ? 26 : d < 70 ? 22 : 16 },
    { id: "digging_hammer", w: d < 45 ? 10 : d < 70 ? 16 : 22 },
    { id: "gap_hunter", w: d < 45 ? 6 : d < 70 ? 14 : 24 },
    { id: "topic_hopper", w: d < 45 ? 6 : d < 70 ? 10 : 14 },
    { id: "interrupting", w: d < 45 ? 4 : d < 70 ? 8 : 16 },
    { id: "stone_face", w: d < 45 ? 2 : d < 70 ? 4 : 8 },
  ];

  const p = String(examinerProfile ?? "standard");
  for (const item of base) {
    if (p === "rapidfire" && (item.id === "topic_hopper" || item.id === "gap_hunter")) item.w += 8;
    if (p === "redflag" && (item.id === "digging_hammer" || item.id === "neutral_structured")) item.w += 6;
    if (p === "guidelines" && item.id === "neutral_structured") item.w += 6;
    if (p === "communication" && item.id === "coach_helpful") item.w += 6;
  }

  if (t === "streng") {
    for (const item of base) {
      if (item.id === "stone_face" || item.id === "digging_hammer" || item.id === "interrupting") item.w += 4;
      if (item.id === "coach_helpful") item.w -= 4;
    }
  } else if (t === "freundlich") {
    for (const item of base) {
      if (item.id === "coach_helpful" || item.id === "neutral_structured") item.w += 4;
      if (item.id === "stone_face") item.w -= 2;
    }
  }

  const pool = base.filter((x) => x.w > 0);
  const sum = pool.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * sum;
  for (const it of pool) {
    r -= it.w;
    if (r <= 0) return it.id;
  }
  return "neutral_structured";
}

function inferPhaseFromTurns(messages) {
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns <= 1) return "intro";
  if (userTurns === 2) return "ddx";
  if (userTurns === 3) return "diagnostics";
  if (userTurns === 4) return "management";
  return "closing";
}

function shouldEscalate({ difficulty, messages }) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);
  const turns = messages.filter((m) => m.role === "user").length;
  if (turns < 1) return false;

  const p = d >= 85 ? 0.35 : d >= 70 ? 0.25 : d >= 45 ? 0.15 : 0.08;

  const lastFew = messages
    .slice(-4)
    .map((m) => (m.role === "assistant" ? m.content : ""))
    .join(" ");

  const alreadyEscalatedRecently =
    /Verschärfung:|Patient wird schlechter|Sättigung fällt|RR fällt|plötzlich/i.test(lastFew);

  if (alreadyEscalatedRecently) return Math.random() < p * 0.35;
  return Math.random() < p;
}

function miniFeedbackStyleForDifficulty(difficulty) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);

  if (d < 35)
    return {
      enabled: true,
      style:
        "sehr freundlich und ermutigend: erst 1 Mini-Lob, dann 1 sanfte Korrektur/Verbesserung (ohne zu demotivieren).",
    };
  if (d < 55)
    return {
      enabled: true,
      style: "freundlich-neutral: 1 Satz, ausgewogen (kurz loben + klarer Verbesserungspunkt).",
    };
  if (d < 70)
    return {
      enabled: true,
      style:
        "kritischer/prüfungsnah: 1 Satz, direkt, fokussiert auf größte Lücke + nächsten Schritt; wenig Lob.",
    };
  return { enabled: false, style: "kein Feedback" };
}

// Helper: OpenAI output_text extrahieren
function extractOutputText(data) {
  return (
    data?.output?.[0]?.content?.find?.((c) => c?.type === "output_text")?.text ??
    data?.output_text ??
    ""
  );
}

// ---- fetch (Node 20+ hat global fetch) ----
const _fetch = globalThis.fetch;

// --- Examiner turn ---
app.post("/api/examiner-turn", async (req, res) => {
  try {
    const { cfg, generatedCase, messages } = req.body ?? {};
    if (!cfg || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing cfg or messages" });
    }

    const fachrichtung = String(cfg?.fachrichtung ?? "Innere Medizin");
    const innereSubfach = String(cfg?.innereSubfach ?? "all");
    const tone = String(cfg?.tone ?? "neutral");
    const difficulty = clamp(Number(cfg?.difficulty ?? 65), 0, 100);
    const examinerProfile = String(cfg?.examinerProfile ?? "standard");

    const caseTitle = String(generatedCase?.title ?? "");
    const vignette = String(generatedCase?.vignette ?? "");
    const startQuestion = String(generatedCase?.startQuestion ?? "");
    const checklist = generatedCase?.checklist ?? null;

    const persona = pickExaminerPersona({ tone, difficulty, examinerProfile });

    const asOpenAiLike = messages.map((m) => ({
      role: m.role === "examiner" ? "assistant" : "user",
      content: String(m.text ?? ""),
    }));

    const phase = inferPhaseFromTurns(asOpenAiLike);

    const escalate = shouldEscalate({
      difficulty,
      messages: asOpenAiLike,
    });

    const escalationLine = escalate
      ? buildEscalationLine({
          fachrichtung,
          phase,
          vignette,
          title: caseTitle,
        })
      : null;

    const mf = miniFeedbackStyleForDifficulty(difficulty);

    const personaStyle =
      persona === "coach_helpful"
        ? "Du bist eher unterstützend: gib maximal 1 kurzen Hinweis, wenn der Kandidat hängt."
        : persona === "digging_hammer"
        ? "Du hakst auf einem Punkt nach, bis er sauber begründet ist."
        : persona === "gap_hunter"
        ? "Du suchst gezielt nach Lücken und prüfst genau die schwache Stelle."
        : persona === "topic_hopper"
        ? "Du wechselst zügig das Thema, um Breite zu prüfen (aber bleibst im Fallkontext)."
        : persona === "interrupting"
        ? "Du unterbrichst gelegentlich und lenkst auf Prioritäten/Red Flags."
        : persona === "stone_face"
        ? "Du gibst kaum Bestätigung, bleibst kühl und knapp."
        : "Du bist neutral, strukturiert, OSCE-nah.";

    const toneStyle =
      tone === "streng"
        ? "Ton: streng, knapp, fordernd."
        : tone === "freundlich"
        ? "Ton: freundlich, unterstützend, aber prüfungsnah."
        : "Ton: neutral-professionell.";

    const difficultyStyle =
      difficulty >= 85
        ? "Sehr anspruchsvoll: wie im echten M3, tiefe Nachfragen, wenig Hilfestellung."
        : difficulty >= 70
        ? "Anspruchsvoll: knapp, zügig, prüfungsnah, Begründungen einfordern."
        : difficulty >= 45
        ? "Mittel: strukturiert, kleine Hinweise möglich, aber nicht spoilern."
        : "Einsteigerfreundlich: stark strukturierend, kleine Hilfen erlaubt.";

    const systemInstructions = `
Du bist ein medizinischer Prüfer für Studierende (OSCE/M3-tauglich).
Du führst ein Prüfungsgespräch als Dialog und reagierst auf die letzte Antwort.

Ziel: maximale Lernwirksamkeit + realistische Prüfungssituation.
Du bleibst IMMER im Fallkontext und im Fachgebiet.

Rahmen:
- Fach: ${fachrichtung}
- Innere-Unterfach: ${innereSubfach}
- ${toneStyle}
- Schwierigkeit: ${difficulty} (0..100) → ${difficultyStyle}
- Prüferprofil: ${examinerProfile}
- Prüferverhalten (dynamisch): ${personaStyle}

Phasensteuerung:
- Aktuelle Phase (intern): ${phase}
- Du steuerst grob: intro → ddx → diagnostics → management → closing
- Wenn Kandidat gut ist: geh tiefer (Begründung, Priorisierung, nächste Konsequenz).
- Wenn Kandidat unsicher ist: eng führen (max 1 Hinweis), dann erneut prüfen.

Fallverschärfung:
- Für diesen Turn: escalate=${escalate ? "true" : "false"}.
- Wenn escalate=true: Nutze GENAU die vorgegebene Verschärfungs-Zeile (kein Erfinden zusätzlicher Befunde).
- Ausgabe: erste Zeile "Verschärfung: <...>", danach genau 1 Frage.

Ausgabeformat (sehr wichtig):
- PRO TURN genau 1 Frage (max 2 Sätze).
- Wenn miniFeedbackEnabled=true: genau EINE zusätzliche Zeile am Ende beginnend mit "Feedback:" (max 1 Satz).
- Keine Tabellen, keine langen Monologe.
- Antworte als reiner Text.
`.trim();

    const caseContext = `
FALLKONTEXT:
Titel: ${caseTitle}
Vignette: ${vignette}
Startfrage: ${startQuestion}

Checkliste (intern, nur Rahmen):
${checklist ? JSON.stringify(checklist).slice(0, 6000) : "—"}
`.trim();

    const miniFeedbackHint = mf.enabled
      ? `miniFeedbackEnabled=true → Gib am Ende genau EINE Zeile "Feedback: ..." (max 1 Satz).
Stil: ${mf.style}
Inhalt: Mischung aus (a) fachlich (Priorisierung/Red Flags/next step) und (b) formal (Struktur, Klarheit, Priorisierung, Vortragsweise).
Wichtig: nicht spoilern, keine langen Erklärungen.`
      : "miniFeedbackEnabled=false → KEINE 'Feedback:' Zeile ausgeben.";

    const escalationHint = escalationLine
      ? `Wenn du verschärfst, nutze GENAU diese Verschärfung (eine Zeile): ${escalationLine}`
      : "Keine Verschärfung in diesem Turn.";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });
    }

    if (!_fetch) {
      return res.status(500).json({ error: "Missing global fetch in this Node runtime" });
    }

    const reqId = Math.random().toString(16).slice(2);
    const t0 = Date.now();

    const resp = await _fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5",
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: systemInstructions },
          { role: "system", content: caseContext },
          { role: "system", content: escalationHint },
          { role: "system", content: miniFeedbackHint },
          ...asOpenAiLike,
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[examiner-turn][${reqId}] OpenAI error ${resp.status}:`, errText?.slice?.(0, 2000));
      return res.status(500).json({ error: "OpenAI error", status: resp.status, detail: errText });
    }

    const data = await resp.json();
    const text = extractOutputText(data);
    const dt = Date.now() - t0;

    console.log(
      `[examiner-turn][${reqId}] ok in ${dt}ms (difficulty=${difficulty}, persona=${persona}, phase=${phase})`
    );

    return res.json({ text: String(text).trim() });
  } catch (e) {
    console.error("[examiner-turn] Server crashed:", e);
    return res.status(500).json({ error: "Server crashed", detail: String(e?.message ?? e) });
  }
});

// --- Feedback report ---
app.post("/api/feedback-report", async (req, res) => {
  try {
    const { cfg, generatedCase, messages } = req.body ?? {};
    if (!cfg || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing cfg or messages" });
    }

    const fachrichtung = String(cfg?.fachrichtung ?? "Innere Medizin");
    const innereSubfach = String(cfg?.innereSubfach ?? "all");
    const tone = String(cfg?.tone ?? "neutral");
    const difficulty = clamp(Number(cfg?.difficulty ?? 65), 0, 100);
    const examinerProfile = String(cfg?.examinerProfile ?? "standard");

    const caseTitle = String(generatedCase?.title ?? "");
    const vignette = String(generatedCase?.vignette ?? "");
    const startQuestion = String(generatedCase?.startQuestion ?? "");
    const checklist = generatedCase?.checklist ?? null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });
    }

    if (!_fetch) {
      return res.status(500).json({ error: "Missing global fetch in this Node runtime" });
    }

    const convo = messages
      .filter((m) => m && (m.role === "user" || m.role === "examiner"))
      .map((m) => ({
        role: m.role === "examiner" ? "assistant" : "user",
        content: String(m.text ?? ""),
      }));

    const tier = difficultyTier(difficulty);
    const styleLine =
      tier === "low"
        ? "Stil: warm, ermutigend, konkret, 1–2 kleine Verbesserungspunkte."
        : tier === "mid"
        ? "Stil: nüchtern-konstruktiv, klar priorisiert, ohne zu demotivieren."
        : tier === "high"
        ? "Stil: prüfungsnah, direkt, kritisch, keine langen Erklärungen."
        : "Stil: sehr knapp, hart priorisiert, kein Lob, nur die wichtigsten Defizite + next steps.";

    const system = `
Du bist eine sehr erfahrene medizinische Prüfer:in (M3/OSCE) und Coach.
Du erstellst ein Abschluss-Feedback für ein reales Prüfungsgespräch (deutsch).

Rahmen:
- Fach: ${fachrichtung}
- Innere-Unterfach: ${innereSubfach}
- Schwierigkeit: ${difficulty} (0..100)
- Prüferprofil: ${examinerProfile}
- Ton-Einstellung der App: ${tone}
- ${styleLine}

Regeln:
- Beziehe dich NUR auf Inhalte, die in der Konversation wirklich vorkamen.
- Wenn etwas nicht gesagt wurde: dann als Lücke benennen, aber nicht so tun, als wäre es gesagt worden.
- Fallkontext/Checkliste sind nur Hintergrund (nicht wörtlich zitieren).
- Keine Tabellen.
- Output MUSS valides JSON sein, ohne Backticks, ohne zusätzlichen Text.
`.trim();

    const schema = `
Schema exakt (valide JSON):

{
  "overall": { "score": 0, "one_liner": "..." },
  "medical": {
    "likely_dx": ["..."],
    "dangerous_ddx_missing": ["..."],
    "diagnostics_next_best": ["..."],
    "management_next_best": ["..."],
    "red_flags": ["..."]
  },
  "communication": {
    "structure": { "score": 0, "note": "..." },
    "prioritization": { "score": 0, "note": "..." },
    "clarity": { "score": 0, "note": "..." },
    "empathy": { "score": 0, "note": "..." }
  },
  "top3_strengths": ["...","...","..."],
  "top3_improvements": ["...","...","..."],
  "next_time_script": {
    "opening": "1-2 Sätze",
    "ddx": "1-2 Sätze",
    "diagnostics": "1-2 Sätze",
    "management": "1-2 Sätze",
    "closing": "1-2 Sätze"
  },
  "drills": [{ "title": "...", "why": "...", "how": "..." }]
}
`.trim();

    const caseContext = `
FALLKONTEXT:
Titel: ${caseTitle}
Vignette: ${vignette}
Startfrage: ${startQuestion}
Checkliste (intern, nur Rahmen):
${checklist ? JSON.stringify(checklist).slice(0, 6000) : "—"}
`.trim();

    const reqId = Math.random().toString(16).slice(2);

    const resp = await _fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5",
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: system },
          { role: "system", content: schema },
          { role: "system", content: caseContext },
          ...convo,
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[feedback-report][${reqId}] OpenAI error ${resp.status}:`, errText?.slice?.(0, 2000));
      return res.status(500).json({ error: "OpenAI error", status: resp.status, detail: errText });
    }

    const data = await resp.json();
    const text = extractOutputText(data);

    const parsed = extractJsonObject(text);
    if (!parsed) {
      console.error(`[feedback-report][${reqId}] AI returned non-JSON:`, String(text).slice(0, 500));
      return res.status(500).json({ error: "AI returned non-JSON", detail: String(text).slice(0, 2000) });
    }

    return res.json({ report: parsed });
  } catch (e) {
    console.error("[feedback-report] Server crashed:", e);
    return res.status(500).json({ error: "Server crashed", detail: String(e?.message ?? e) });
  }
});

// ✅ Listen on 0.0.0.0 (Render + LAN)
app.listen(PORT, HOST, () => {
  console.log(`VivaMed server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
