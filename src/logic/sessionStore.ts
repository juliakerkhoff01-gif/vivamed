// src/logic/sessionStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { markCaseDone } from "./streaks";

const KEY = "vivamed_sessions_v1";

export type StoredSession = {
  id: string;
  ts: number;

  caseId?: string;
  fachrichtung: string;
  mode?: "text" | "voice" | string;

  overallScore?: number;
  phaseScores?: Record<string, number>;

  // flexible Erweiterung
  [key: string]: any;
};

function randomId() {
  return `${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export async function loadSessions(): Promise<StoredSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const list: StoredSession[] = Array.isArray(parsed) ? parsed : [];
    // neueste zuerst
    list.sort((a, b) => Number(b.ts ?? 0) - Number(a.ts ?? 0));
    return list;
  } catch {
    return [];
  }
}

async function saveSessions(list: StoredSession[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function clearSessions() {
  await AsyncStorage.removeItem(KEY);
}

/**
 * Speichert eine Session.
 * - Wenn id fehlt: wird erzeugt
 * - Wenn ts fehlt: wird Date.now() gesetzt
 * - Aktualisiert oder fügt ein
 * - ✅ MERGE statt overwrite (damit spätere Updates z.B. AI-Report nicht alte Felder löschen)
 * - Danach: markiert "Fall heute erledigt" fürs Streak-System
 */
export async function saveSession(input: Partial<StoredSession> & { fachrichtung: string }): Promise<StoredSession> {
  const session: StoredSession = {
    id: input.id ?? randomId(),
    ts: input.ts ?? Date.now(),
    ...input,
  } as any;

  const list = await loadSessions();
  const idx = list.findIndex((s) => s.id === session.id);

  if (idx >= 0) {
    // ✅ merge
    list[idx] = { ...list[idx], ...session };
  } else {
    list.unshift(session);
  }

  await saveSessions(list);

  // Streak-Fall heute setzen (niemals crashen lassen)
  try {
    await markCaseDone();
  } catch {}

  return session;
}
