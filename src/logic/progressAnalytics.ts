// src/logic/progressAnalytics.ts

type AnySession = any;

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function avg(nums: number[]) {
  const clean = nums.filter((n) => Number.isFinite(n)) as number[];
  if (clean.length === 0) return 0;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function getTs(s: AnySession): number {
  const v = s?.ts ?? s?.createdAt ?? s?.date ?? s?.startedAt ?? 0;
  return typeof v === "number" ? v : new Date(v).getTime();
}

function getOverallScore(s: AnySession): number | null {
  const candidates = [
    s?.overallScore,
    s?.score,
    s?.feedback?.overallScore,
    s?.feedback?.score,
    s?.result?.overallScore,
    s?.result?.score,
  ];
  const found = candidates.find((x) => typeof x === "number");
  return typeof found === "number" ? found : null;
}

function getPhaseScore(s: AnySession, phase: string): number | null {
  const containers = [
    s?.phaseScores,
    s?.scoresByPhase,
    s?.feedback?.phaseScores,
    s?.feedback?.scoresByPhase,
    s?.result?.phaseScores,
    s?.result?.scoresByPhase,
  ].filter(Boolean);

  for (const ps of containers) {
    const v = ps?.[phase];
    if (typeof v === "number") return v;
    if (v && typeof v?.score === "number") return v.score;
  }
  return null;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysBetween(a: number, b: number) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((a - b) / ms);
}

export type SkillScores = {
  ddx: number;
  diagnostics: number;
  management: number;
  communication: number;
  redFlags: number;
};

export type ProgressAnalytics = {
  avgScore: number;
  casesLast7Days: number;
  streakCurrent: number;
  streakBest: number;
  bestImproveLabel: string;
  bestImproveDelta: number;
  skills: SkillScores;
};

function computeSkills(sessions: AnySession[]): SkillScores {
  const ddx = clamp01(avg(sessions.map((s) => getPhaseScore(s, "ddx") ?? getOverallScore(s) ?? 0)));
  const diagnostics = clamp01(avg(sessions.map((s) => getPhaseScore(s, "diagnostics") ?? getOverallScore(s) ?? 0)));
  const management = clamp01(avg(sessions.map((s) => getPhaseScore(s, "management") ?? getOverallScore(s) ?? 0)));

  // V1-Näherungen (bis du echte Kategorien getrennt scorst)
  const communication = clamp01(avg(sessions.map((s) => getPhaseScore(s, "closing") ?? getOverallScore(s) ?? 0)));
  const redFlags = clamp01(avg(sessions.map((s) => getPhaseScore(s, "ddx") ?? getOverallScore(s) ?? 0)));

  return { ddx, diagnostics, management, communication, redFlags };
}

function computeStreaks(sessions: AnySession[]) {
  if (!sessions.length) return { streakCurrent: 0, streakBest: 0 };

  const days = Array.from(
    new Set(
      sessions
        .map((s) => startOfDay(getTs(s)))
        .filter((x) => Number.isFinite(x) && x > 0)
    )
  ).sort((a, b) => b - a);

  if (!days.length) return { streakCurrent: 0, streakBest: 0 };

  const today = startOfDay(Date.now());
  const mostRecent = days[0];
  const gapToToday = daysBetween(today, mostRecent);

  // Wenn letzte Session vor >1 Tag war -> streak 0
  let streakCurrent = 0;
  if (gapToToday === 0 || gapToToday === 1) {
    streakCurrent = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1];
      const cur = days[i];
      if (daysBetween(prev, cur) === 1) streakCurrent++;
      else break;
    }
  }

  // Best streak: längste consecutive-run
  let streakBest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    if (daysBetween(prev, cur) === 1) run++;
    else run = 1;
    streakBest = Math.max(streakBest, run);
  }

  return { streakCurrent, streakBest };
}

function computeCasesLast7Days(sessions: AnySession[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => getTs(s) >= cutoff).length;
}

function computeBestImprove(sessions: AnySession[]) {
  // V1: vergleicht letzte 7 Sessions vs. die 7 davor
  const sorted = [...sessions].sort((a, b) => getTs(a) - getTs(b));
  const last = sorted.slice(-7);
  const prev = sorted.slice(-14, -7);

  const lastSkills = computeSkills(last);
  const prevSkills = computeSkills(prev);

  const deltas: Array<{ label: keyof SkillScores; delta: number }> = (Object.keys(lastSkills) as (keyof SkillScores)[])
    .map((k) => ({ label: k, delta: (lastSkills[k] ?? 0) - (prevSkills[k] ?? 0) }))
    .sort((a, b) => b.delta - a.delta);

  const best = deltas[0] ?? { label: "ddx", delta: 0 };

  const pretty: Record<string, string> = {
    ddx: "DDx",
    diagnostics: "Diagnostik",
    management: "Management",
    communication: "Kommunikation",
    redFlags: "Red Flags",
  };

  return { bestImproveLabel: pretty[String(best.label)] ?? String(best.label), bestImproveDelta: best.delta };
}

export function computeProgressAnalytics(sessions: AnySession[]): ProgressAnalytics {
  const avgScore = clamp01(avg(sessions.map((s) => getOverallScore(s) ?? 0)));
  const skills = computeSkills(sessions);
  const { streakCurrent, streakBest } = computeStreaks(sessions);
  const casesLast7Days = computeCasesLast7Days(sessions);
  const { bestImproveLabel, bestImproveDelta } = computeBestImprove(sessions);

  return {
    avgScore,
    casesLast7Days,
    streakCurrent,
    streakBest,
    bestImproveLabel,
    bestImproveDelta,
    skills,
  };
}
