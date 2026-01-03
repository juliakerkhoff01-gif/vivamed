// server/index.js (ESM)
// Lokal:   OPENAI_API_KEY=... PORT=8791 npm run dev
// Render:  setzt PORT automatisch, OPENAI_API_KEY + OPENAI_MODEL in Render Env setzen

import express from "express";
import cors from "cors";
import { buildEscalationLine } from "./escalations.js";
const BUILD_TAG = "health-v2-2026-01-03-2159";
const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const HOST = "0.0.0.0";

// ---- CORS (robust für Expo Go / iPhone + Preflight) ----
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// Body JSON
app.use(express.json({ limit: "2mb" }));

// ---- Mini Request Logger ----
app.use((req, _res, next) => {
  const t = new Date().toISOString();
  console.log(`[${t}] ${req.method} ${req.path}`);
  next();
});

// --- Root ---
app.get("/", (_req, res) => res.redirect("/health"));

// --- Health ---
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "vivamed-server",
    port: PORT,
    time: new Date().toISOString(),
    env: process.env.RENDER ? "render" : "local",
    build: BUILD_TAG,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.2",
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

// --- Helpers: robust JSON extraction for feedback-report (Fallback) ---
function extractJsonObject(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;

  try {
    return JSON.parse(s);
  } catch {}

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

// ---- Text-Sanitizing (keine Abkürzungen etc.) ----
function sanitizeExaminerText(t) {
  let s = String(t ?? "").trim();
  if (!s) return "";

  s = s.replace(/\bDDx\b/gi, "Differentialdiagnosen");
  s = s.replace(/\bDx\b/gi, "Diagnose");
  s = s.replace(/\bTx\b/gi, "Therapie");
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}

// ---- Super-robuste Text-Extraktion (Responses API + Fallbacks) ----
// Hintergrund: output[] kann Reasoning-/Tool-Items enthalten; output_text ist ein Helper, aber nicht immer da. :contentReference[oaicite:3]{index=3}
function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return sanitizeExaminerText(data.output_text);
  }

  const texts = [];

  const out = Array.isArray(data?.output) ? data.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string" && c.text.trim()) texts.push(c.text);
      if (typeof c?.text === "string" && c.text.trim()) texts.push(c.text);
      if (typeof c?.content === "string" && c.content.trim()) texts.push(c.content);
    }

    if (typeof item?.text === "string" && item.text.trim()) texts.push(item.text);
  }

  // Legacy-ish fallbacks
  const maybeChat =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.result?.content;
  if (typeof maybeChat === "string" && maybeChat.trim()) texts.push(maybeChat);

  // very defensive regex fallback
  if (texts.length === 0) {
    try {
      const raw = JSON.stringify(data);
      const m1 = raw.match(/"output_text"\s*:\s*"([^"]{2,8000})"/);
      const m2 = raw.match(/"text"\s*:\s*"([^"]{2,8000})"/);
      if (m1?.[1]) texts.push(m1[1]);
      else if (m2?.[1]) texts.push(m2[1]);
    } catch {}
  }

  return sanitizeExaminerText(texts.join("\n").trim());
}

// ✅ letzte Nutzerantwort
function lastUserAnswer(openAiLikeMessages) {
  const last = [...openAiLikeMessages].reverse().find((m) => m.role === "user");
  return String(last?.content ?? "").trim();
}

// ---- Hint detection (Tipps / Hilfe) ----
function isTipRequest(text) {
  const s = String(text ?? "").toLowerCase();
  return (
    /\btipp\b/.test(s) ||
    /hinweis/.test(s) ||
    /help/.test(s) ||
    /hilfe/.test(s) ||
    (/kannst du mir/.test(s) && /tipp|hinweis|helfen/.test(s))
  );
}

// ---- fetch (Node 20+ hat global fetch) ----
const _fetch = globalThis.fetch;

// ---- OpenAI Request Helper mit Timeout ----
async function openaiResponsesCall({ apiKey, body, reqId, timeoutMs = 30000 }) {
  if (!_fetch) throw new Error("Missing global fetch in this Node runtime");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await _fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[openai][${reqId}] OpenAI error ${resp.status}:`, errText?.slice?.(0, 2000));
      const e = new Error(`OpenAI error ${resp.status}`);
      e.status = resp.status;
      e.detail = errText;
      throw e;
    }

    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---- Fallback, damit NIE leer zurückkommt (P0) :contentReference[oaicite:4]{index=4} ----
function fallbackExaminerTurn({ userLast, phase, escalationLine, mfEnabled }) {
  const quote = userLast ? `"${userLast.slice(0, 40).replace(/\n/g, " ")}${userLast.length > 40 ? "…" : ""}"` : `"—"`;

  const q =
    phase === "intro"
      ? "Was ist Ihre führende Arbeitshypothese und welche Information fehlt Ihnen noch am meisten?"
      : phase === "ddx"
      ? "Nennen Sie die drei wichtigsten Differentialdiagnosen und sagen Sie kurz, was Sie jeweils erwarten würden."
      : phase === "diagnostics"
      ? "Was ist jetzt die nächste beste Diagnostik – und warum genau diese als nächster Schritt?"
      : phase === "management"
      ? "Was ist Ihr akuter Management-Plan in den nächsten 10 Minuten?"
      : "Was ist Ihre Abschlussdiagnose, und welche zwei Punkte würden Sie der Patientin/dem Patienten jetzt erklären?";

  const lines = [];
  if (escalationLine) lines.push(`Verschärfung: ${escalationLine}`);
  lines.push(`Bezug: ${quote}`);
  lines.push(q);
  if (mfEnabled) lines.push("Feedback: Strukturieren Sie kurz (Problem → Priorität → nächster Schritt).");
  return lines.join("\n");
}

// ---- Handler: Examiner turn ----
async function handleExaminerTurn(req, res) {
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

    // KI-Modus
    const aiModeRaw = String(cfg?.aiMode ?? "").trim().toLowerCase();
    const aiMode =
      aiModeRaw === "training" || aiModeRaw === "exam"
        ? aiModeRaw
        : difficulty < 70
        ? "training"
        : "exam";

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

    const escalate = shouldEscalate({ difficulty, messages: asOpenAiLike });
    const escalationLine = escalate
      ? buildEscalationLine({ fachrichtung, phase, vignette, title: caseTitle })
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

    const userLast = lastUserAnswer(asOpenAiLike);
    const userAskedTip = isTipRequest(userLast);

    const tipPolicy =
      userAskedTip
        ? `
TIPP-REGEL (sehr wichtig):
- Der Kandidat hat um einen Tipp gebeten.
- Antworte neutral-professionell und gib GENAU EINEN kleinen Tipp/Hinweis.
- Kein Spoiler (keine fertige Diagnose).
- Danach stelle wieder GENAU EINE Frage, passend zum Fall.
`.trim()
        : `
TIPP-REGEL:
- Wenn der Kandidat NICHT um einen Tipp bittet, gib keine extra Tipps.
`.trim();

    const modeLine =
      aiMode === "exam"
        ? `
Modus: PRÜFUNGSSIMULATION.
- Knapp, fordernd, M3-nah.
- Du prüfst v.a. Prioritäten, Red Flags, Begründung.
- Bei difficulty>=70 darfst du unterbrechen, um Präzision/Prioritäten einzufordern.
(Hinweis: Tipp-Regel hat Vorrang, falls der Kandidat um einen Tipp bittet.)
`.trim()
        : `
Modus: TRAINING.
- Zugewandt, menschlich, aber prüfungsnah.
- Bei Unschärfe: 1x nachfragen + max 1 Mini-Hinweis (ohne Spoiler).
- Keine langen Erklärungen: führe mit gezielten Fragen.
`.trim();

    const systemInstructions = `
Du bist ein echter medizinischer Prüfer (M3/OSCE), deutsch, realistisch, menschlich.
Du führst eine mündliche Prüfung als Dialog. Du reagierst präzise auf die letzte Antwort.

${modeLine}

Rahmen:
- Fach: ${fachrichtung}
- Innere-Unterfach: ${innereSubfach}
- ${toneStyle}
- Schwierigkeit: ${difficulty} (0..100) → ${difficultyStyle}
- Prüferprofil: ${examinerProfile}
- Prüferverhalten (dynamisch): ${personaStyle}
- Aktuelle Phase (intern): ${phase}

WICHTIG (Sprache):
- Keine Abkürzungen: nicht "DDx/Dx/Tx". Schreibe aus.
- Kurze Sätze. Keine Textwand. Keine Tabellen. Keine Bullet-Listen.

Prüferlogik:
1) Bezugspflicht: beziehe dich immer auf 1–2 konkrete Elemente. Zitat 1–6 Wörter in Anführungszeichen.
2) Hartnäckigkeit: bleib 1–2 Turns an Unklarheiten.
3) Unterbrechen (nur difficulty>=70): "Unterbrechung:" + 1 Satz Korrektur + dann 1 präzise Frage.

${tipPolicy}

Fallverschärfung:
- escalate=${escalate ? "true" : "false"}
- Wenn escalate=true: nutze GENAU die vorgegebene Verschärfung.

Ausgabeformat:
- Max 4 kurze Zeilen.
- Zeile 1: optional "Verschärfung:" oder "Unterbrechung:"
- Zeile 2: 1 kurzer Bezug mit Zitat
- Zeile 3: GENAU 1 Frage
- Zeile 4: optional "Feedback:" nur wenn miniFeedbackEnabled=true
- Pro Turn genau 1 Frage. Reiner Text.

Letzte Kandidatenantwort:
"${userLast}"
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
      ? `miniFeedbackEnabled=true → Am Ende GENAU EINE Zeile "Feedback: ..." (max 1 Satz).
Stil: ${mf.style}
Wichtig: nicht spoilern, keine langen Erklärungen.`
      : "miniFeedbackEnabled=false → KEINE 'Feedback:' Zeile ausgeben.";

    const escalationHint = escalationLine
      ? `Wenn du verschärfst, nutze GENAU diese Verschärfung (eine Zeile): ${escalationLine}`
      : "Keine Verschärfung in diesem Turn.";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const model = process.env.OPENAI_MODEL || "gpt-5.2"; // gpt-5 ist „previous“, 5.2 ist aktuell empfohlen :contentReference[oaicite:5]{index=5}

    const reqId = Math.random().toString(16).slice(2);
    const t0 = Date.now();

    const body = {
      model,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: systemInstructions },
        { role: "system", content: caseContext },
        { role: "system", content: escalationHint },
        { role: "system", content: miniFeedbackHint },
        ...asOpenAiLike,
      ],
    };

    let data = await openaiResponsesCall({ apiKey, reqId, timeoutMs: 45000, body });
    let text = extractOutputText(data);

    // Retry 1x (falls leer)
    if (!text) {
      console.warn(`[examiner-turn][${reqId}] EMPTY TEXT → retry once`);
      const retryBody = {
        ...body,
        input: [
          {
            role: "system",
            content:
              systemInstructions +
              "\n\nWICHTIG: Gib JETZT unbedingt eine Text-Antwort aus (mindestens 1 Zeile). Kein leerer Output.",
          },
          { role: "system", content: caseContext },
          { role: "system", content: escalationHint },
          { role: "system", content: miniFeedbackHint },
          ...asOpenAiLike,
        ],
      };
      data = await openaiResponsesCall({ apiKey, reqId: `${reqId}-r`, timeoutMs: 45000, body: retryBody });
      text = extractOutputText(data);
    }

    const dt = Date.now() - t0;

    // ✅ P0: NIE leer zurückgeben → Fallback statt 502 :contentReference[oaicite:6]{index=6}
    if (!text) {
      console.error(
        `[examiner-turn][${reqId}] STILL EMPTY after retry. Raw response (truncated):`,
        JSON.stringify(data).slice(0, 4000)
      );

      const fallback = fallbackExaminerTurn({
        userLast,
        phase,
        escalationLine,
        mfEnabled: mf.enabled,
      });

      return res.json({
        text: fallback,
        meta: { mode: aiMode, phase, persona, tipAsked: Boolean(userAskedTip), fallbackUsed: true },
      });
    }

    console.log(
      `[examiner-turn][${reqId}] ok in ${dt}ms (model=${model}, mode=${aiMode}, difficulty=${difficulty}, persona=${persona}, phase=${phase}, tipAsked=${userAskedTip})`
    );

    return res.json({
      text: String(text).trim(),
      meta: { mode: aiMode, phase, persona, tipAsked: Boolean(userAskedTip), fallbackUsed: false },
    });
  } catch (e) {
    const status = Number(e?.status ?? 500);
    const detail = e?.detail ?? String(e?.message ?? e);
    console.error("[examiner-turn] error:", e);

    // ✅ Auch hier: lieber „weicher“ als App kaputt
    if (status >= 500) {
      return res.status(200).json({
        text:
          'Bezug: "—"\nIch habe gerade ein technisches Problem. Was wäre Ihr nächster klinischer Schritt (Priorität) – und warum?',
        meta: { fallbackUsed: true, error: true },
      });
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "examiner-turn failed",
      detail: String(detail).slice(0, 4000),
    });
  }
}

// --- Primary route + Aliases ---
app.post("/api/examiner-turn", handleExaminerTurn);
app.post("/api/examinerTurn", handleExaminerTurn);
app.post("/api/chat", handleExaminerTurn);
app.post("/api/simulate", handleExaminerTurn);

// --- Feedback report (Structured Outputs) ---
async function handleFeedbackReport(req, res) {
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
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const model = process.env.OPENAI_MODEL || "gpt-5.2";

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
- Wenn etwas nicht gesagt wurde: als Lücke benennen, nicht erfinden.
- Keine Tabellen.
`.trim();

    const caseContext = `
FALLKONTEXT:
Titel: ${caseTitle}
Vignette: ${vignette}
Startfrage: ${startQuestion}
Checkliste (intern, nur Rahmen):
${checklist ? JSON.stringify(checklist).slice(0, 6000) : "—"}
`.trim();

    // Structured Outputs: JSON Schema statt „bitte JSON“ (viel stabiler) :contentReference[oaicite:7]{index=7}
    const feedbackSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        overall: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: { type: "number" },
            one_liner: { type: "string" },
          },
          required: ["score", "one_liner"],
        },
        medical: {
          type: "object",
          additionalProperties: false,
          properties: {
            likely_dx: { type: "array", items: { type: "string" } },
            dangerous_ddx_missing: { type: "array", items: { type: "string" } },
            diagnostics_next_best: { type: "array", items: { type: "string" } },
            management_next_best: { type: "array", items: { type: "string" } },
            red_flags: { type: "array", items: { type: "string" } },
          },
          required: [
            "likely_dx",
            "dangerous_ddx_missing",
            "diagnostics_next_best",
            "management_next_best",
            "red_flags",
          ],
        },
        communication: {
          type: "object",
          additionalProperties: false,
          properties: {
            structure: {
              type: "object",
              additionalProperties: false,
              properties: { score: { type: "number" }, note: { type: "string" } },
              required: ["score", "note"],
            },
            prioritization: {
              type: "object",
              additionalProperties: false,
              properties: { score: { type: "number" }, note: { type: "string" } },
              required: ["score", "note"],
            },
            clarity: {
              type: "object",
              additionalProperties: false,
              properties: { score: { type: "number" }, note: { type: "string" } },
              required: ["score", "note"],
            },
            empathy: {
              type: "object",
              additionalProperties: false,
              properties: { score: { type: "number" }, note: { type: "string" } },
              required: ["score", "note"],
            },
          },
          required: ["structure", "prioritization", "clarity", "empathy"],
        },
        top3_strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
        top3_improvements: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
        next_time_script: {
          type: "object",
          additionalProperties: false,
          properties: {
            opening: { type: "string" },
            ddx: { type: "string" },
            diagnostics: { type: "string" },
            management: { type: "string" },
            closing: { type: "string" },
          },
          required: ["opening", "ddx", "diagnostics", "management", "closing"],
        },
        drills: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              why: { type: "string" },
              how: { type: "string" },
            },
            required: ["title", "why", "how"],
          },
        },
      },
      required: [
        "overall",
        "medical",
        "communication",
        "top3_strengths",
        "top3_improvements",
        "next_time_script",
        "drills",
      ],
    };

    const reqId = Math.random().toString(16).slice(2);

    const data = await openaiResponsesCall({
      apiKey,
      reqId,
      timeoutMs: 60000,
      body: {
        model,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: system },
          { role: "system", content: caseContext },
          ...convo,
        ],
        text: {
          format: {
            type: "json_schema",
            strict: true,
            name: "vivamed_feedback_report",
            schema: feedbackSchema,
          },
        },
      },
    });

    // Bei Structured Outputs ist output_text oft JSON-String; wir parsen sicherheitshalber:
    const text = extractOutputText(data);
    const parsed = extractJsonObject(text) ?? data?.output_parsed ?? null;

    if (!parsed) {
      console.error(`[feedback-report][${reqId}] Could not parse structured output. Text:`, String(text).slice(0, 500));
      return res.status(500).json({ error: "AI returned non-JSON", detail: String(text).slice(0, 2000) });
    }

    return res.json({ report: parsed });
  } catch (e) {
    const status = Number(e?.status ?? 500);
    const detail = e?.detail ?? String(e?.message ?? e);
    console.error("[feedback-report] error:", e);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "feedback-report failed",
      detail: String(detail).slice(0, 4000),
    });
  }
}

app.post("/api/feedback-report", handleFeedbackReport);
app.post("/api/feedbackReport", handleFeedbackReport);

// ---- 404 Handler ----
app.use((req, res) => {
  return res.status(404).json({
    error: "Not found",
    method: req.method,
    path: req.path,
    hint: "Try /health and /api/examiner-turn.",
  });
});

// ---- Global Error Handler ----
app.use((err, _req, res, _next) => {
  console.error("[express] unhandled error:", err);
  res.status(500).json({ error: "Server crashed", detail: String(err?.message ?? err) });
});

// ✅ Listen
app.listen(PORT, HOST, () => {
  console.log(`VivaMed server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠️  OPENAI_API_KEY is NOT set. /api/* calls will fail until you set it.");
  }
});
