import AsyncStorage from "@react-native-async-storage/async-storage";
import { Phase } from "./cases";

const KEY = "vivamed_skills_v1";

type PhaseSkill = {
  count: number;   // wie oft geübt
  sum: number;     // Summe der Scores (0..5)
  lastTs: number;  // letzter Zeitpunkt
};

export type SkillStore = {
  version: 1;
  phases: Record<Phase, PhaseSkill>;
};

function emptyStore(): SkillStore {
  const zero = { count: 0, sum: 0, lastTs: 0 };
  return {
    version: 1,
    phases: {
      intro: { ...zero },
      ddx: { ...zero },
      diagnostics: { ...zero },
      management: { ...zero },
      closing: { ...zero },
    },
  };
}

export async function loadSkills(): Promise<SkillStore> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as SkillStore;
    if (!parsed?.phases) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

async function saveSkills(store: SkillStore) {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function recordSkillAttempt(params: { phase: Phase; score: number }) {
  const store = await loadSkills();
  const phase = params.phase;

  const score = Math.max(0, Math.min(5, Number(params.score) || 0));

  const cur = store.phases[phase] ?? { count: 0, sum: 0, lastTs: 0 };
  const next: PhaseSkill = {
    count: cur.count + 1,
    sum: cur.sum + score,
    lastTs: Date.now(),
  };

  store.phases[phase] = next;
  await saveSkills(store);
}

export async function clearSkills() {
  await AsyncStorage.removeItem(KEY);
}

export function summarizeSkills(store: SkillStore) {
  const phases = (Object.keys(store.phases) as Phase[]).map((p) => {
    const s = store.phases[p];
    const avg = s.count > 0 ? s.sum / s.count : 0;
    return { phase: p, avg, count: s.count, lastTs: s.lastTs };
  });

  const worst = [...phases].filter((x) => x.count > 0).sort((a, b) => a.avg - b.avg)[0] ?? null;

  return { phases, worst };
}
