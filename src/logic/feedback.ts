import { ChatMessage, SessionConfig, FeedbackSheet } from "../types";
import { phaseForTurn, Phase, getCaseById, ChecklistItem } from "./cases";

function clamp1to5(n: number) {
  return Math.max(1, Math.min(5, n));
}

function norm(s: string) {
  return (s || "").toLowerCase();
}

function hasAny(text: string, words: string[]) {
  const t = norm(text);
  return words.some((w) => t.includes(w));
}

function phaseLabel(p: Phase) {
  if (p === "intro") return "Einstieg";
  if (p === "ddx") return "DDx";
  if (p === "diagnostics") return "Diagnostik";
  if (p === "management") return "Management";
  return "Abschluss";
}

function checklistHitCount(text: string, items: ChecklistItem[]) {
  const hits: ChecklistItem[] = [];
  const misses: ChecklistItem[] = [];
  for (const it of items) {
    if (hasAny(text, it.keywords.map((k) => k.toLowerCase()))) hits.push(it);
    else misses.push(it);
  }
  return { hits, misses };
}

type PhaseRow = {
  phase: Phase;
  title: string;
  score: number;
  note: string;
  hits: string[];
  misses: string[];
};

export function generateFeedback(
  cfg: SessionConfig | undefined,
  messages: ChatMessage[],
  caseId?: string
): FeedbackSheet & { phaseRows: PhaseRow[]; caseTitle?: string } {
  const userMsgs = messages.filter((m) => m.role === "user");

  // Text pro Phase sammeln
  const phaseText: Record<Phase, string> = {
    intro: "",
    ddx: "",
    diagnostics: "",
    management: "",
    closing: "",
  };

  userMsgs.forEach((m, idx) => {
    const p = phaseForTurn(idx);
    phaseText[p] += `\n${m.text}`;
  });

  const c = getCaseById(caseId);

  // Fallback: wenn kein Case bekannt (sollte selten sein)
  const emptyRows: PhaseRow[] = (["intro", "ddx", "diagnostics", "management", "closing"] as Phase[]).map((p) => ({
    phase: p,
    title: phaseLabel(p),
    score: 3,
    note: "Kein Fall gefunden – Standard-Feedback.",
    hits: [],
    misses: [],
  }));

  const rows: PhaseRow[] = c
    ? (Object.keys(phaseText) as Phase[]).map((p) => {
        const items = c.checklist[p] || [];
        const { hits, misses } = checklistHitCount(norm(phaseText[p]), items);
        const total = Math.max(1, items.length);
        const ratio = hits.length / total;

        // Score: 1..5 proportional
        const score = clamp1to5(1 + Math.round(4 * ratio));

        const note =
          hits.length === 0
            ? `Treffer 0/${items.length}. Hier fehlen die Kernpunkte.`
            : `Treffer ${hits.length}/${items.length}.`;

        return {
          phase: p,
          title: phaseLabel(p),
          score,
          note,
          hits: hits.map((x) => x.label),
          misses: misses.map((x) => x.label),
        };
      })
    : emptyRows;

  // Performance global
  const allUserText = norm(userMsgs.map((m) => m.text).join("\n"));
  const hasStructure = /1|2|3|erstens|zweitens|drittens|zunächst|dann|abschließend|•|-/.test(allUserText);
  const avgLen = userMsgs.length
    ? userMsgs.map((m) => m.text.length).reduce((a, b) => a + b, 0) / userMsgs.length
    : 0;
  const concise = avgLen < 260;

  const structureScore = clamp1to5((hasStructure ? 4 : 2) + (concise ? 1 : 0));
  const pressureScore = clamp1to5((concise ? 3 : 2) + (hasStructure ? 1 : 0) + (cfg?.difficulty && cfg.difficulty >= 70 ? 1 : 0));

  // Content = Mittelwert aus DDx/Diagnostik/Management rows
  const getPhaseScore = (p: Phase) => rows.find((r) => r.phase === p)?.score ?? 3;
  const contentAvg = (getPhaseScore("ddx") + getPhaseScore("diagnostics") + getPhaseScore("management")) / 3;
  const safetyScore = clamp1to5(getPhaseScore("intro") + 1);

  // Top Improvements = die größten Lücken
  const improvements = rows
    .map((r) => ({
      phase: r.phase,
      misses: r.misses,
      score: r.score,
    }))
    .filter((x) => x.misses.length > 0)
    .sort((a, b) => a.score - b.score) // schlechteste zuerst
    .flatMap((x) => x.misses.slice(0, 2).map((m) => `${phaseLabel(x.phase)}: Nenne auch „${m}“.`))
    .slice(0, 3);

  const sheet: FeedbackSheet = {
    performance: [
      { title: "Struktur & Klarheit", score: structureScore, note: hasStructure ? "Struktur erkennbar." : "Nutze Stichpunkte/3-Step." },
      { title: "Prüfungsstil (kurz & priorisiert)", score: pressureScore, note: concise ? "Gut: eher knapp." : "Kürzer werden: Prioritäten + Stichpunkte." },
    ],
    content: [
      { title: "Fall-Checkliste (Phasen)", score: clamp1to5(Math.round((rows.reduce((a, r) => a + r.score, 0) / rows.length))), note: "Fall-spezifisch ausgewertet." },
      { title: "Sicherheit / Red Flags", score: safetyScore, note: "Einstieg zählt hier besonders." },
    ],
    topImprovements: improvements.length ? improvements : ["Sehr solide — als nächstes: mehr Pro/Contra bei DDx & klare Priorisierung."],
  };

  return { ...sheet, phaseRows: rows, caseTitle: c?.title };
}
