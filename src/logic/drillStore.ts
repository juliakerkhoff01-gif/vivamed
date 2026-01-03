import AsyncStorage from "@react-native-async-storage/async-storage";

export type Drill = {
  id: string;
  createdAt: number;

  fachrichtung: string;
  caseId?: string;

  title: string;
  why: string;

  // Status
  doneCount: number;
  lastDoneAt?: number;
};

const KEY = "vivamed:drills:v1";
const MAX = 200;

export async function loadDrills(): Promise<Drill[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Drill[];
  } catch {
    return [];
  }
}

export async function saveDrills(newOnes: Drill[]): Promise<void> {
  const existing = await loadDrills();

  // Dedup: gleiche title+fachrichtung+caseId nicht doppelt
  const has = (d: Drill) =>
    existing.some(
      (e) =>
        e.title === d.title &&
        e.fachrichtung === d.fachrichtung &&
        (e.caseId ?? "") === (d.caseId ?? "")
    );

  const merged = [...newOnes.filter((d) => !has(d)), ...existing].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
}

export async function markDrillDone(id: string): Promise<void> {
  const existing = await loadDrills();
  const next = existing.map((d) =>
    d.id === id
      ? { ...d, doneCount: (d.doneCount ?? 0) + 1, lastDoneAt: Date.now() }
      : d
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearDrills(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
