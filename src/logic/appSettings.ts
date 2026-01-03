// src/logic/appSettings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_FACHRICHTUNGEN, INNERE_SUBFAECHER } from "./fachrichtungen";

const KEY = "vivamed_app_settings_v1";

// ✅ Version A: 5 Simulationen + 1 Drill Demo
const DEFAULT_DEMO_SIM_LIMIT = 5;

export type AppSettings = {
  version: 1;
  onboardingDone: boolean;

  preferredFachrichtung?: string;
  preferredInnereSubfach?: string;
  preferredMode?: "text" | "voice";

  examDateMs?: number | null;
  dailyMinutes?: number | null;

  /** zentrale Server-URL für Expo Go / iPhone */
  aiBaseUrl?: string;

  /** Monetization flags (V1) */
  isPro?: boolean;

  /** Demo Limits */
  demoSimUsedCount?: number;
  demoSimLimit?: number;
  demoDrillUsed?: boolean;

  // legacy:
  demoSimUsed?: boolean;
};

function clamp(n: number, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeAiBaseUrl(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.includes("DEINE_MAC_IP")) return ""; // ✅ Placeholder blocken

  let out = s.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(out)) out = `http://${out}`;
  return out;
}

function defaultSettings(): AppSettings {
  return {
    version: 1,
    onboardingDone: false,
    preferredMode: "text",
    preferredFachrichtung: "Innere Medizin",
    preferredInnereSubfach: "all",
    examDateMs: null,
    dailyMinutes: 10,

    // ✅ bewusst leer / placeholder-bereinigt → App fällt automatisch auf Local-Modus
    aiBaseUrl: "",

    // monetization defaults
    isPro: false,

    // Version A defaults
    demoSimUsedCount: 0,
    demoSimLimit: DEFAULT_DEMO_SIM_LIMIT,
    demoDrillUsed: false,
  };
}

function isAllowedFachrichtung(v: any): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return APP_FACHRICHTUNGEN.some((it) => String(it.value) === s);
}

function normalizeFachrichtung(v: any): string {
  const s = String(v ?? "").trim();
  return isAllowedFachrichtung(s) ? s : "Innere Medizin";
}

function isAllowedInnereSubfach(v: any): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return INNERE_SUBFAECHER.some((it) => String(it.value) === s);
}

function normalizeInnereSubfach(fachrichtung: string, sub: any): string {
  if (fachrichtung !== "Innere Medizin") return "";
  const s = String(sub ?? "").trim();
  if (!s) return "all";
  return isAllowedInnereSubfach(s) ? s : "all";
}

function normalizeExamDateMs(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDailyMinutes(v: any): number {
  if (v === null || v === undefined) return 10;
  return clamp(Number(v), 5, 120);
}

function normalizeDemoSimLimit(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DEMO_SIM_LIMIT;
  return Math.floor(n);
}

function normalizeDemoSimUsedCount(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Migration + Normalisierung:
 * - alt: demoSimUsed boolean → neu: demoSimUsedCount = 1
 */
function normalizeSettings(raw: any): AppSettings {
  const base = defaultSettings();

  const onboardingDone = !!raw?.onboardingDone;
  const preferredMode: "text" | "voice" = raw?.preferredMode === "voice" ? "voice" : "text";

  const fachrichtung = normalizeFachrichtung(raw?.preferredFachrichtung);
  const innereSubfach = normalizeInnereSubfach(fachrichtung, raw?.preferredInnereSubfach);

  const isPro = !!raw?.isPro;

  const demoSimLimit = normalizeDemoSimLimit(raw?.demoSimLimit ?? base.demoSimLimit);

  // migration: demoSimUsed (boolean) => count=1
  const legacyUsed = !!raw?.demoSimUsed;
  const demoSimUsedCount = normalizeDemoSimUsedCount(raw?.demoSimUsedCount ?? (legacyUsed ? 1 : 0));

  const demoDrillUsed = !!raw?.demoDrillUsed;

  return {
    ...base,
    ...raw,

    version: 1,
    onboardingDone,

    preferredMode,
    preferredFachrichtung: fachrichtung,
    preferredInnereSubfach: innereSubfach,

    examDateMs: normalizeExamDateMs(raw?.examDateMs),
    dailyMinutes: normalizeDailyMinutes(raw?.dailyMinutes),

    aiBaseUrl: normalizeAiBaseUrl(raw?.aiBaseUrl ?? base.aiBaseUrl),

    isPro,

    demoSimLimit,
    demoSimUsedCount,
    demoDrillUsed,

    demoSimUsed: legacyUsed,
  };
}

export async function loadAppSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaultSettings();

  try {
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed ?? {});
  } catch {
    return defaultSettings();
  }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadAppSettings();
  const merged = { ...current, ...patch };
  const next = normalizeSettings(merged);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function resetAppSettings() {
  await AsyncStorage.removeItem(KEY);
}

export async function getAiBaseUrl(): Promise<string> {
  const s = await loadAppSettings();
  return normalizeAiBaseUrl((s as any)?.aiBaseUrl);
}

/**
 * ✅ pingServerHealth: prüft nicht nur HTTP ok,
 * sondern auch JSON { ok: true }
 */
export async function pingServerHealth(baseUrl?: string): Promise<boolean> {
  const url = normalizeAiBaseUrl(baseUrl ?? (await getAiBaseUrl()));
  if (!url) return false;

  try {
    const r = await fetch(`${url}/health`, { method: "GET" });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return !!j && j.ok === true;
  } catch {
    return false;
  }
}

/** akzeptiert "dd.mm.yyyy" oder "yyyy-mm-dd" */
export function parseDateInputToMs(input: string): number | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m1) {
    const dd = Number(m1[1]);
    const mm = Number(m1[2]);
    const yyyy = Number(m1[3]);
    if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }

  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    const yyyy = Number(m2[1]);
    const mm = Number(m2[2]);
    const dd = Number(m2[3]);
    if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }

  return null;
}

export function computeDaysLeftSimple(examDateMs: number | null | undefined): number | null {
  if (!examDateMs) return null;
  const now = Date.now();
  const diff = examDateMs - now;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/**
 * Monetization helpers (Version A)
 * Gratis: 5 Simulationen + 1 Drill
 */
export async function canStartSimulation(): Promise<{ ok: boolean; reason?: string }> {
  const s = await loadAppSettings();
  if (s.isPro) return { ok: true };

  const limit = normalizeDemoSimLimit(s.demoSimLimit);
  const used = normalizeDemoSimUsedCount(s.demoSimUsedCount);

  if (used < limit) return { ok: true };

  return {
    ok: false,
    reason: `Demo verbraucht (${limit} Simulationen). Für weitere Simulationen brauchst du Pro.`,
  };
}

export async function markDemoSimulationUsed(): Promise<void> {
  const s = await loadAppSettings();
  if (s.isPro) return;

  const limit = normalizeDemoSimLimit(s.demoSimLimit);
  const used = normalizeDemoSimUsedCount(s.demoSimUsedCount);

  if (used >= limit) return;

  await saveAppSettings({
    demoSimUsedCount: used + 1,
    demoSimUsed: true,
  });
}

export async function canOpenTraining(): Promise<{ ok: boolean; reason?: string }> {
  const s = await loadAppSettings();
  if (s.isPro) return { ok: true };
  if (!s.demoDrillUsed) return { ok: true };
  return { ok: false, reason: "Demo-Drill verbraucht. Für alle Drills brauchst du Pro." };
}

export async function markDemoDrillUsed(): Promise<void> {
  const s = await loadAppSettings();
  if (s.isPro) return;
  if (s.demoDrillUsed) return;
  await saveAppSettings({ demoDrillUsed: true });
}

export async function getDemoSimulationMeta(): Promise<{
  limit: number;
  used: number;
  left: number;
  isPro: boolean;
}> {
  const s = await loadAppSettings();
  const isPro = !!s.isPro;
  const limit = normalizeDemoSimLimit(s.demoSimLimit);
  const used = normalizeDemoSimUsedCount(s.demoSimUsedCount);
  const left = Math.max(0, limit - used);
  return { limit, used, left, isPro };
}
