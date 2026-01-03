// src/logic/aiCaseFactory.ts
import { CaseTemplate, CaseChecklist, ChecklistItem, Phase } from "./cases";

/**
 * V1 "KI" Case Factory:
 * - gibt IMMER ein CaseTemplate zurück (kompatibel mit deiner App)
 * - deterministisch pro Tag + Fachrichtung + Unterfach + Fokus (damit "heute" stabil bleibt)
 *
 * Später ersetzt du die Funktion generateAiCaseTemplate(...) intern durch echten API Call.
 */

export type FocusSkill = "DDx" | "Diagnostik" | "Management" | "Kommunikation" | "Red Flags";

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

function hashToInt(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000_000;
}

function pickBySeed<T>(arr: T[], seed: number): T {
  if (!arr.length) throw new Error("pickBySeed: empty array");
  const idx = seed % arr.length;
  return arr[idx];
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function item(label: string, keywords: string[]): ChecklistItem {
  return { label, keywords: uniq(keywords.map((k) => String(k).toLowerCase())) };
}

function ensureChecklistShape(partial: Partial<CaseChecklist>): CaseChecklist {
  const phases: Phase[] = ["intro", "ddx", "diagnostics", "management", "closing"];
  const out: any = {};
  for (const p of phases) out[p] = Array.isArray((partial as any)[p]) ? (partial as any)[p] : [];
  return out as CaseChecklist;
}

function focusHint(focus: FocusSkill) {
  if (focus === "DDx") return "Schwerpunkt: breite DDx + Priorisierung.";
  if (focus === "Diagnostik") return "Schwerpunkt: gezielte Diagnostik + Begründung.";
  if (focus === "Management") return "Schwerpunkt: Akutmaßnahmen + Leitlinienlogik.";
  if (focus === "Kommunikation") return "Schwerpunkt: strukturierte Kommunikation + Safety Net.";
  return "Schwerpunkt: Red Flags erkennen + gefährliche DDx ausschließen.";
}

function buildChecklist(fach: string, subfach: string | null, focus: FocusSkill, seed: number): CaseChecklist {
  // Basis-Items (universell)
  const introBase = [
    item("ABCDE / Vitalparameter", ["abcde", "vital", "rr", "puls", "hf", "af", "spo2", "temperatur"]),
    item("Monitoring / i.v. Zugang", ["monitor", "ekg", "zugang", "iv"]),
    item("Red Flags aktiv suchen", ["red flag", "instabil", "schock", "sepsis", "bewusstsein"]),
  ];

  const closingBase = [
    item("1 Satz Problem + Risiko", ["problem", "risiko", "instabil", "gefährlich", "wahrscheinlich"]),
    item("1 nächster Schritt", ["als nächstes", "nächster schritt", "jetzt", "weiteres vorgehen"]),
  ];

  // Fokus-Items: je Skill ein paar Extra-Häppchen
  const focusDDx = [
    item("Top-5 DDx priorisieren", ["ddx", "differential", "priorisieren"]),
    item("Gefährliche DDx zuerst", ["lebensbedrohlich", "ausschließen", "notfall"]),
    item("1-2 DDx begründen (pro/contra)", ["pro", "contra", "begründung"]),
  ];

  const focusDx = [
    item("Zielgerichtete Diagnostik (was ändert Management?)", ["diagnostik", "ändert therapie", "entscheidung"]),
    item("Labor + Bildgebung passend zur DDx", ["labor", "sono", "ct", "röntgen", "ekg"]),
    item("Befundinterpretation", ["interpret", "befund", "spricht für", "spricht gegen"]),
  ];

  const focusMgmt = [
    item("Sofortmaßnahmen (A/B/C)", ["sofort", "o2", "volumen", "zugang", "monitor"]),
    item("Therapie-Reihenfolge", ["reihenfolge", "zuerst", "dann"]),
    item("Disposition / Überwachung", ["icu", "überwachung", "stationär", "ambulant"]),
  ];

  const focusComm = [
    item("Patientenorientierte Sprache", ["verständlich", "patient", "erklären"]),
    item("Shared Decision / Einwilligung", ["einwilligung", "risiken", "alternativen"]),
    item("Safety Net / Warnzeichen", ["warnzeichen", "wiederkommen", "kontrolle"]),
  ];

  const focusRedFlags = [
    item("3 lebensbedrohliche Ursachen", ["lebensbedrohlich", "gefährlich", "ausschließen"]),
    item("Zeitkritische Diagnostik", ["sofort", "stat", "notfall"]),
    item("Instabilitätskriterien", ["schock", "hypoton", "tachy", "gcs", "resp"]),
  ];

  const pickFocus = () => {
    if (focus === "DDx") return focusDDx;
    if (focus === "Diagnostik") return focusDx;
    if (focus === "Management") return focusMgmt;
    if (focus === "Kommunikation") return focusComm;
    return focusRedFlags;
  };

  const focusItems = pickFocus();

  // "Fach"-typische DDx/Diagnostik/Management-Bausteine (sehr grob, MVP)
  const fachKey = `${fach}::${subfach ?? ""}`.toLowerCase();

  const ddxPool: ChecklistItem[] = [
    item("Infektion/Sepsis", ["sepsis", "infekt", "fieber"]),
    item("Kardiovaskulär", ["acs", "infarkt", "arrhythmie", "schock"]),
    item("Pulmonal", ["pneumonie", "le", "pneumothorax", "asthma", "copd"]),
    item("Abdomen akut", ["appendizitis", "cholezystitis", "ileus", "pankreatitis"]),
    item("Metabolisch", ["dka", "hhs", "hypoglykämie", "elektrolyt"]),
    item("Neurologisch", ["stroke", "krampfanfall", "meningitis"]),
  ];

  const dxPool: ChecklistItem[] = [
    item("Labor (BB/CRP/Elyte/Niere)", ["labor", "bb", "crp", "elektrolyt", "krea"]),
    item("EKG", ["ekg"]),
    item("Sono / POCUS", ["sono", "ultraschall", "pocus"]),
    item("Röntgen/CT (je nach DDx)", ["röntgen", "ct", "mrt"]),
  ];

  const mgmtPool: ChecklistItem[] = [
    item("Analgesie/Antiemese", ["analgesie", "schmerz", "antiemese"]),
    item("Volumen/O2 nach Bedarf", ["volumen", "ringer", "nacl", "o2", "sauerstoff"]),
    item("Antibiotika falls indiziert", ["antibiotika", "ab", "sepsis"]),
    item("Konsil/Disposition", ["konsil", "station", "icu", "überwachung"]),
  ];

  // kleine “Biases” je Fachrichtung
  const ddxExtra =
    fachKey.includes("chir") ? [item("Chirurgische Notfälle", ["peritonitis", "strangulation", "perforation"])] :
    fachKey.includes("pädi") ? [item("Pädiatrische Red Flags", ["meningitis", "dehydratation", "fieberkrampf"])] :
    fachKey.includes("gyn") ? [item("Gyn/SS als DDx", ["ss", "eug", "torsion", "hcg"])] :
    fachKey.includes("neurol") ? [item("Akute neurologische DDx", ["stroke", "blutung", "krampf"])] :
    [];

  const seed2 = seed + 1337;

  const ddx = [pickBySeed(ddxPool, seed), pickBySeed(ddxPool, seed2), ...ddxExtra].slice(0, 5);
  const diagnostics = [pickBySeed(dxPool, seed + 7), pickBySeed(dxPool, seed + 17), pickBySeed(dxPool, seed + 27)];
  const management = [pickBySeed(mgmtPool, seed + 3), pickBySeed(mgmtPool, seed + 23), pickBySeed(mgmtPool, seed + 43)];

  return ensureChecklistShape({
    intro: [...introBase, ...focusItems.slice(0, 1)],
    ddx: [...ddx, ...focusItems.slice(1, 2)],
    diagnostics: [...diagnostics, ...focusItems.slice(0, 1)],
    management: [...management, ...focusItems.slice(1, 3)],
    closing: [...closingBase],
  });
}

function buildCaseText(fach: string, subfach: string | null, focus: FocusSkill, seed: number) {
  const titles = [
    "Akute Vorstellung in der ZNA",
    "Symptomkomplex unklarer Genese",
    "Zeitkritischer Notfall",
    "Klassischer Prüfungsfall",
  ];

  const symptoms = [
    "plötzlicher Schmerz",
    "Luftnot",
    "Schwindel/Synkope",
    "Fieber mit reduziertem AZ",
    "Bauchschmerzen mit Übelkeit",
    "Brustschmerz mit vegetativer Symptomatik",
  ];

  const setting = [
    "in der Notaufnahme",
    "auf Station",
    "in der Hausarztpraxis",
    "im Rettungsdienst",
  ];

  const t = pickBySeed(titles, seed);
  const s1 = pickBySeed(symptoms, seed + 11);
  const s2 = pickBySeed(symptoms, seed + 19);
  const where = pickBySeed(setting, seed + 29);

  const sub = subfach && subfach !== "all" ? ` (${subfach})` : "";
  const title = `${fach}${sub} · ${t}`;

  const vignette =
    `Du siehst eine*n Patient*in ${where} mit ${s1}. Zusätzlich berichtet er/sie über ${s2}. ` +
    `Der Eindruck ist prüfungsrelevant und du sollst strukturiert vorgehen.\n` +
    `${focusHint(focus)}`;

  const startQuestion =
    focus === "Management"
      ? "Starte: Welche 3 Sofortmaßnahmen machst du JETZT (Stichpunkte)?"
      : focus === "Diagnostik"
      ? "Starte: Welche 3 Untersuchungen/Labore ordnest du als erstes an – und warum?"
      : focus === "Red Flags"
      ? "Starte: Welche 5 Red Flags fragst/prüfst du sofort (Stichpunkte)?"
      : focus === "Kommunikation"
      ? "Starte: Wie erklärst du kurz das Vorgehen und sicherst Einwilligung/Verständnis?"
      : "Starte: Nenne deine Top-5 DDx (priorisiert) und 1 Begründung.";

  return { title, vignette, startQuestion };
}

export function makeAiCaseId(params: {
  dateKey: string;
  fachrichtung: string;
  innereSubfach?: string | null;
  focusSkill: FocusSkill;
}) {
  const sub = (params.innereSubfach ?? "").trim();
  const subPart = sub && sub !== "all" ? sub : "all";
  const safeF = String(params.fachrichtung ?? "Unknown").replace(/\s+/g, "-");
  const safeS = String(subPart).replace(/\s+/g, "-");
  const safeK = String(params.focusSkill).replace(/\s+/g, "-");
  return `ai-${params.dateKey}-${safeF}-${safeS}-${safeK}`.toLowerCase();
}

export async function generateAiCaseTemplate(input: {
  fachrichtung: string;
  innereSubfach?: string | null;
  focusSkill: FocusSkill;
  dateKey?: string; // optional (für Tests)
}): Promise<CaseTemplate> {
  const dk = input.dateKey ?? dateKey(startOfDay(Date.now()));
  const fach = String(input.fachrichtung ?? "Innere Medizin");
  const subRaw = String(input.innereSubfach ?? "all").trim();
  const sub = subRaw.length ? subRaw : "all";
  const focus = input.focusSkill;

  const id = makeAiCaseId({ dateKey: dk, fachrichtung: fach, innereSubfach: sub, focusSkill: focus });

  const seedStr = `${id}::${fach}::${sub}::${focus}`;
  const seed = hashToInt(seedStr);

  const { title, vignette, startQuestion } = buildCaseText(fach, sub !== "all" ? sub : null, focus, seed);
  const checklist = buildChecklist(fach, sub !== "all" ? sub : null, focus, seed);

  const out: CaseTemplate = {
    id,
    fachrichtung: fach,
    subfach: fach === "Innere Medizin" && sub !== "all" ? sub : undefined,
    title,
    vignette,
    startQuestion,
    checklist,
  };

  return out;
}
