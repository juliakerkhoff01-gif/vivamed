import { ChatMessage } from "../types";

export type PhaseKey = "intro" | "ddx" | "diagnostics" | "management" | "closing";

type ChecklistItem = {
  label: string;
  keywords?: string[];
};

type CaseChecklist = Partial<Record<PhaseKey, ChecklistItem[]>>;

type CaseLike = {
  id: string;
  title: string;
  checklist?: CaseChecklist;
};

export type FeedbackItemResult = {
  phase: PhaseKey;
  label: string;
  matched: boolean;
  matchedKeyword?: string;
};

export type CoachingPoint = {
  phase: PhaseKey;
  label: string;
  example: string;
};

export type FeedbackSummary = {
  totalItems: number;
  matchedItems: number;
  overallScore: number; // 0-100

  phaseScores: Record<PhaseKey, { total: number; matched: number; score: number }>;

  results: FeedbackItemResult[];
  topMissing: FeedbackItemResult[];
  topMatched: FeedbackItemResult[];

  good3: CoachingPoint[];
  fix3: CoachingPoint[];

  drills: { title: string; why: string }[];
};

const PHASES: PhaseKey[] = ["intro", "ddx", "diagnostics", "management", "closing"];

function norm(s: string) {
  return (s ?? "").toLowerCase();
}

function includesKeyword(haystack: string, keyword: string) {
  const k = norm(keyword).trim();
  if (!k) return false;
  return haystack.includes(k);
}

function phaseTitle(p: PhaseKey) {
  if (p === "intro") return "Einstieg";
  if (p === "ddx") return "DDx";
  if (p === "diagnostics") return "Diagnostik";
  if (p === "management") return "Management";
  return "Abschluss";
}

function exampleSentence(phase: PhaseKey, label: string) {
  // bewusst „vorlesbar“ und generisch (ohne KI)
  if (phase === "intro")
    return `„Ich würde strukturiert starten und kurz ${label} erheben/klären.“`;
  if (phase === "ddx")
    return `„In der Differenzialdiagnose denke ich vorrangig an ${label} – und würde das als Nächstes einordnen.“`;
  if (phase === "diagnostics")
    return `„Diagnostisch würde ich ${label} als Nächstes veranlassen, um die Verdachtsdiagnose zu sichern.“`;
  if (phase === "management")
    return `„Therapeutisch würde ich ${label} zügig einleiten und parallel überwachen.“`;
  return `„Zum Abschluss würde ich ${label} zusammenfassen und das weitere Vorgehen kurz absprechen.“`;
}

function pickDistinctPhases(
  items: FeedbackItemResult[],
  n: number,
  matched: boolean
): CoachingPoint[] {
  const out: CoachingPoint[] = [];
  const used = new Set<PhaseKey>();

  for (const it of items) {
    if (it.matched !== matched) continue;
    if (used.has(it.phase)) continue;

    out.push({
      phase: it.phase,
      label: it.label,
      example: exampleSentence(it.phase, it.label),
    });
    used.add(it.phase);

    if (out.length >= n) return out;
  }

  // Fallback: auffüllen, auch wenn Phase doppelt
  for (const it of items) {
    if (it.matched !== matched) continue;
    if (out.some((x) => x.label === it.label && x.phase === it.phase)) continue;

    out.push({
      phase: it.phase,
      label: it.label,
      example: exampleSentence(it.phase, it.label),
    });

    if (out.length >= n) break;
  }

  return out.slice(0, n);
}

export function computeFeedback(theCase: CaseLike | null, messages: ChatMessage[]): FeedbackSummary {
  const userText = norm(
    messages
      .filter((m: any) => m.role === "user")
      .map((m) => m.text)
      .join(" \n")
  );

  const phaseScores: FeedbackSummary["phaseScores"] = {
    intro: { total: 0, matched: 0, score: 0 },
    ddx: { total: 0, matched: 0, score: 0 },
    diagnostics: { total: 0, matched: 0, score: 0 },
    management: { total: 0, matched: 0, score: 0 },
    closing: { total: 0, matched: 0, score: 0 },
  };

  const results: FeedbackItemResult[] = [];
  const checklist = (theCase?.checklist ?? {}) as CaseChecklist;

  for (const phase of PHASES) {
    const items = checklist[phase] ?? [];
    for (const item of items) {
      const keywords = item.keywords ?? [];
      let matchedKeyword: string | undefined;

      const matched = keywords.some((k) => {
        const ok = includesKeyword(userText, k);
        if (ok) matchedKeyword = k;
        return ok;
      });

      results.push({
        phase,
        label: item.label,
        matched,
        matchedKeyword,
      });

      phaseScores[phase].total += 1;
      if (matched) phaseScores[phase].matched += 1;
    }
  }

  // Phase scores
  for (const phase of PHASES) {
    const p = phaseScores[phase];
    p.score = p.total === 0 ? 0 : Math.round((p.matched / p.total) * 100);
  }

  const totalItems = results.length;
  const matchedItems = results.filter((r) => r.matched).length;
  const overallScore = totalItems === 0 ? 0 : Math.round((matchedItems / totalItems) * 100);

  // Reihenfolge: wir nehmen die Results so, wie sie im Checklist-Order kommen (ist meist didaktisch sinnvoll)
  const topMissing = results.filter((r) => !r.matched).slice(0, 6);
  const topMatched = results.filter((r) => r.matched).slice(0, 6);

  const good3 = pickDistinctPhases(results, 3, true);
  const fix3 = pickDistinctPhases(results, 3, false);

  // Drills: 1–2 schwächste Phasen + optional Red-Flag/Quickcheck
  const rankedPhases = [...PHASES]
    .map((p) => ({ phase: p, score: phaseScores[p].score, total: phaseScores[p].total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => a.score - b.score);

  const drills: FeedbackSummary["drills"] = [];
  const take = rankedPhases.slice(0, 2);

  for (const p of take) {
    drills.push({
      title: `${phaseTitle(p.phase)}: 60-Sekunden-Drill`,
      why: `Du warst hier bei ${p.score}%. Übe einmal laut: Struktur → 3 Punkte → Abschlussfrage.`,
    });
  }

  if (topMissing.length >= 4) {
    drills.push({
      title: "Red-Flags & Pflichtbegriffe (Quickcheck)",
      why: "Mehrere Pflichtpunkte fehlen. Lies sie einmal durch und sag sie in 30 Sekunden zusammen.",
    });
  }

  return {
    totalItems,
    matchedItems,
    overallScore,
    phaseScores,
    results,
    topMissing,
    topMatched,
    good3,
    fix3,
    drills,
  };
}
