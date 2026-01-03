// src/logic/examStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ExamRun = {
  id: string;
  createdAt: number;
  fachrichtung: string;
  caseIds: string[];
  cfg: any; // wir speichern cfg "robust" ohne harte Typ-Abhängigkeit
};

const KEY = "VIVAMED_EXAM_RUN_V1";

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export async function loadExamRun(): Promise<ExamRun | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExamRun;
  } catch {
    return null;
  }
}

export async function saveExamRun(run: ExamRun) {
  await AsyncStorage.setItem(KEY, JSON.stringify(run));
}

export async function clearExamRun() {
  await AsyncStorage.removeItem(KEY);
}

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildExamCaseIds(allCases: Array<{ id: string; fachrichtung: string }>, fachrichtung: string) {
  const pool = allCases.filter((c) => c.fachrichtung === fachrichtung);
  const source = pool.length ? pool : allCases;

  // 4 unterschiedliche Fälle (wenn möglich)
  const chosen: string[] = [];
  const maxTries = 200;

  let tries = 0;
  while (chosen.length < 4 && tries < maxTries) {
    tries++;
    const c = pickRandom(source);
    if (!c?.id) continue;
    if (!chosen.includes(c.id)) chosen.push(c.id);
  }

  // Falls zu wenig Content vorhanden ist: auffüllen (mit evtl. Doppeln)
  while (chosen.length < 4) {
    const c = pickRandom(source);
    if (c?.id) chosen.push(c.id);
  }

  return chosen;
}

export async function ensureExamRun(params: {
  cfg: any;
  allCases: Array<{ id: string; fachrichtung: string }>;
}) {
  const existing = await loadExamRun();
  if (existing && existing.caseIds?.length === 4) return existing;

  const cfg = params.cfg ?? {};
  const fachrichtung = String(cfg.fachrichtung ?? "Innere Medizin");
  const caseIds = buildExamCaseIds(params.allCases, fachrichtung);

  const run: ExamRun = {
    id: makeId(),
    createdAt: Date.now(),
    fachrichtung,
    caseIds,
    cfg,
  };

  await saveExamRun(run);
  return run;
}
