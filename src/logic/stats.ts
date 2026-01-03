import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedbackSheet, SessionConfig } from "../types";
import { markCaseDone } from "../logic/streaks"; // Pfad ggf. anpassen


const KEY = "vivamed_stats_v1";

export type SessionRecord = {
  id: string;
  ts: number;
  fachrichtung: string;
  tone: string;
  difficulty: number;
  mode?: "text" | "voice";
  caseId?: string;
  caseTitle?: string;

  // Scores
  phaseScores?: { phase: string; score: number }[];
  performanceAvg: number;
  contentAvg: number;
};

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function loadSessions(): Promise<SessionRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export async function saveSession(params: {
  cfg?: SessionConfig;
  caseId?: string;
  caseTitle?: string;
  sheet: FeedbackSheet;
  phaseRows?: { phase: string; score: number }[];
}) {
  const sessions = await loadSessions();

  const performanceAvg = avg((params.sheet.performance ?? []).map((x) => x.score));
  const contentAvg = avg((params.sheet.content ?? []).map((x) => x.score));

  const rec: SessionRecord = {
    id: makeId(),
    ts: Date.now(),
    fachrichtung: params.cfg?.fachrichtung ?? "Unbekannt",
    tone: params.cfg?.tone ?? "neutral",
    difficulty: params.cfg?.difficulty ?? 0,
    mode: params.cfg?.mode,
    caseId: params.caseId,
    caseTitle: params.caseTitle,
    phaseScores: params.phaseRows,
    performanceAvg,
    contentAvg,
  };

  const next = [rec, ...sessions].slice(0, 200); // max 200 Sessions speichern
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearSessions() {
  await AsyncStorage.removeItem(KEY);
}

export function aggregate(sessions: SessionRecord[]) {
  // Gesamtdurchschnitt
  const overallPerformance = avg(sessions.map((s) => s.performanceAvg));
  const overallContent = avg(sessions.map((s) => s.contentAvg));

  // Phase-Durchschnitt
  const phaseMap: Record<string, number[]> = {};
  sessions.forEach((s) => {
    (s.phaseScores ?? []).forEach((p) => {
      if (!phaseMap[p.phase]) phaseMap[p.phase] = [];
      phaseMap[p.phase].push(p.score);
    });
  });

  const phaseAvg = Object.keys(phaseMap).map((k) => ({
    phase: k,
    avg: avg(phaseMap[k]),
  }));

  // Fachrichtung-Durchschnitt
  const frMap: Record<string, number[]> = {};
  sessions.forEach((s) => {
    if (!frMap[s.fachrichtung]) frMap[s.fachrichtung] = [];
    frMap[s.fachrichtung].push(s.contentAvg);
  });

  const fachrichtungAvg = Object.keys(frMap).map((k) => ({
    fachrichtung: k,
    avg: avg(frMap[k]),
  }));

  return {
    count: sessions.length,
    overallPerformance,
    overallContent,
    phaseAvg,
    fachrichtungAvg,
  };
}
