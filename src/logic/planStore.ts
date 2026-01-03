// src/logic/planStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeProgressAnalytics } from "./progressAnalytics";
import { CaseTemplate } from "./cases";
import { FocusSkill, generateAiCaseTemplate } from "./aiCaseFactory";

export type PlanSettings = {
  examDateMs: number | null;
  daysPerWeek: number; // 1..7

  wahlfach: string | null;
  losfach: string | null;

  // optional: Innere-Unterfächer für Wahl-/Losfach (du nutzt das schon in PlanScreen)
  wahlfachInnereSubfach?: string;
  losfachInnereSubfach?: string;
};

export type TodayPlan = {
  dateKey: string; // YYYY-MM-DD
  createdAt: number;

  fachrichtung: string;

  // Bei KI-Fall:
  caseId: string;

  // ✅ NEU: kompletter Fall (CaseTemplate), damit Simulation/Home/Plan ihn direkt nutzen können
  generatedCase?: CaseTemplate;

  // Adaptiv / Coach
  focusSkill: FocusSkill;
  drillFocus: string;
  suggestedExaminerProfile?: "standard" | "redflag" | "guidelines" | "communication" | "rapidfire";
  suggestedDifficulty?: number; // 0..100

  // optional: Subfach-Info (für Innere)
  innereSubfach?: string; // "all" | ...
};

type AnySession = any;

const SETTINGS_KEY = "VIVAMED_PLAN_SETTINGS_V1";
const TODAY_PLAN_KEY = "VIVAMED_TODAY_PLAN_V1";
const DRILL_DONE_KEY = "VIVAMED_TODAY_DRILL_DONE_V1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateKey(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODateToMs(iso: string): number | null {
  const t = (iso ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;

  const [yS, mS, dS] = t.split("-");
  const y = Number(yS);
  const m = Number(mS);
  const d = Number(dS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function loadPlanSettings(): Promise<PlanSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      examDateMs: null,
      daysPerWeek: 5,
      wahlfach: null,
      losfach: null,
      wahlfachInnereSubfach: "",
      losfachInnereSubfach: "",
    };
  }

  try {
    const x = JSON.parse(raw);
    return {
      examDateMs: typeof x?.examDateMs === "number" ? x.examDateMs : null,
      daysPerWeek: clamp(Number(x?.daysPerWeek ?? 5), 1, 7),
      wahlfach: x?.wahlfach ? String(x.wahlfach) : null,
      losfach: x?.losfach ? String(x.losfach) : null,
      wahlfachInnereSubfach: typeof x?.wahlfachInnereSubfach === "string" ? x.wahlfachInnereSubfach : "",
      losfachInnereSubfach: typeof x?.losfachInnereSubfach === "string" ? x.losfachInnereSubfach : "",
    };
  } catch {
    return {
      examDateMs: null,
      daysPerWeek: 5,
      wahlfach: null,
      losfach: null,
      wahlfachInnereSubfach: "",
      losfachInnereSubfach: "",
    };
  }
}

export async function savePlanSettings(next: PlanSettings) {
  const clean: PlanSettings = {
    examDateMs: typeof next.examDateMs === "number" ? next.examDateMs : null,
    daysPerWeek: clamp(Number(next.daysPerWeek ?? 5), 1, 7),
    wahlfach: next.wahlfach ? String(next.wahlfach) : null,
    losfach: next.losfach ? String(next.losfach) : null,
    wahlfachInnereSubfach: typeof next.wahlfachInnereSubfach === "string" ? next.wahlfachInnereSubfach : "",
    losfachInnereSubfach: typeof next.losfachInnereSubfach === "string" ? next.losfachInnereSubfach : "",
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}

export function computeDaysLeft(examDateMs: number | null) {
  if (!examDateMs) return null;
  const today = startOfDay(Date.now());
  const exam = startOfDay(examDateMs);
  const ms = 24 * 60 * 60 * 1000;
  return Math.ceil((exam - today) / ms);
}

function skillPairsFromAnalytics(a: any) {
  return [
    { label: "DDx" as FocusSkill, v: Number(a?.skills?.ddx ?? 0) },
    { label: "Diagnostik" as FocusSkill, v: Number(a?.skills?.diagnostics ?? 0) },
    { label: "Management" as FocusSkill, v: Number(a?.skills?.management ?? 0) },
    { label: "Kommunikation" as FocusSkill, v: Number(a?.skills?.communication ?? 0) },
    { label: "Red Flags" as FocusSkill, v: Number(a?.skills?.redFlags ?? 0) },
  ].filter((p) => Number.isFinite(p.v));
}

function chooseFocusSkill(sessions: AnySession[]) {
  if (!sessions?.length) return { focusSkill: "DDx" as FocusSkill, focusValue: 0 };

  const a = computeProgressAnalytics(sessions as any);
  const pairs = skillPairsFromAnalytics(a);
  pairs.sort((x, y) => x.v - y.v);

  const weakest = pairs[0] ?? { label: "DDx" as FocusSkill, v: 0 };
  return { focusSkill: weakest.label, focusValue: weakest.v };
}

function suggestProfileForSkill(skill: FocusSkill) {
  if (skill === "Red Flags") return "redflag";
  if (skill === "Kommunikation") return "communication";
  if (skill === "Management") return "guidelines";
  if (skill === "Diagnostik") return "guidelines";
  if (skill === "DDx") return "rapidfire";
  return "standard";
}

function suggestDifficulty(focusValue: number) {
  if (focusValue <= 35) return 85;
  if (focusValue <= 55) return 75;
  return 65;
}

export async function clearTodayPlan() {
  await AsyncStorage.removeItem(TODAY_PLAN_KEY);
}

export function getCaseFromTodayPlan(plan: TodayPlan | null | undefined): CaseTemplate | null {
  if (!plan) return null;
  if (plan.generatedCase && typeof plan.generatedCase?.id === "string") return plan.generatedCase;
  return null;
}

export async function getOrCreateTodayPlan(params: {
  cfg: any;
  sessions?: AnySession[];
}): Promise<TodayPlan> {
  const cfg = params.cfg ?? {};
  const fachrichtung = String(cfg.fachrichtung ?? "Innere Medizin");

  const innereSubfachRaw = String(cfg.innereSubfach ?? "all").trim();
  const innereSubfach = innereSubfachRaw.length ? innereSubfachRaw : "all";

  const todayKey = dateKey(Date.now());

  // 1) bestehenden Plan laden (nur wenn heute + fachrichtung + (optional) subfach matcht)
  const raw = await AsyncStorage.getItem(TODAY_PLAN_KEY);
  if (raw) {
    try {
      const existing = JSON.parse(raw) as TodayPlan;

      const matches =
        existing?.dateKey === todayKey &&
        existing?.fachrichtung === fachrichtung &&
        typeof existing?.caseId === "string" &&
        existing.caseId.length > 0 &&
        // wenn Innere: Subfach soll auch passen (sonst neu generieren)
        (fachrichtung !== "Innere Medizin" || String(existing?.innereSubfach ?? "all") === innereSubfach);

      if (matches) {
        // Falls generatedCase fehlt (alte Daten), regenerieren wir still
        if (!existing.generatedCase) {
          const sess = Array.isArray(params.sessions) ? params.sessions : [];
          const { focusSkill, focusValue } = chooseFocusSkill(sess);
          const generatedCase = await generateAiCaseTemplate({
            fachrichtung,
            innereSubfach,
            focusSkill,
            dateKey: todayKey,
          });

          const repaired: TodayPlan = {
            ...existing,
            focusSkill,
            drillFocus: focusSkill,
            suggestedExaminerProfile: suggestProfileForSkill(focusSkill),
            suggestedDifficulty: suggestDifficulty(focusValue),
            innereSubfach: fachrichtung === "Innere Medizin" ? innereSubfach : "all",
            caseId: generatedCase.id,
            generatedCase,
          };

          await AsyncStorage.setItem(TODAY_PLAN_KEY, JSON.stringify(repaired));
          return repaired;
        }

        return existing;
      }
    } catch {
      // ignore
    }
  }

  // 2) neu erzeugen (adaptiv) → KI-Fall generieren
  const sess = Array.isArray(params.sessions) ? params.sessions : [];
  const { focusSkill, focusValue } = chooseFocusSkill(sess);

  const generatedCase = await generateAiCaseTemplate({
    fachrichtung,
    innereSubfach,
    focusSkill,
    dateKey: todayKey,
  });

  const plan: TodayPlan = {
    dateKey: todayKey,
    createdAt: Date.now(),
    fachrichtung,
    innereSubfach: fachrichtung === "Innere Medizin" ? innereSubfach : "all",

    caseId: generatedCase.id,
    generatedCase,

    focusSkill,
    drillFocus: focusSkill,
    suggestedExaminerProfile: suggestProfileForSkill(focusSkill),
    suggestedDifficulty: suggestDifficulty(focusValue),
  };

  await AsyncStorage.setItem(TODAY_PLAN_KEY, JSON.stringify(plan));
  return plan;
}

export async function markDrillDoneToday() {
  await AsyncStorage.setItem(DRILL_DONE_KEY, dateKey(Date.now()));
}

export async function isDrillDoneToday() {
  const k = await AsyncStorage.getItem(DRILL_DONE_KEY);
  return k === dateKey(Date.now());
}
