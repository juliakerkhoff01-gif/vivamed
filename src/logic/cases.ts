import { SessionConfig } from "../types";

export type Phase = "intro" | "ddx" | "diagnostics" | "management" | "closing";

export type ChecklistItem = {
  label: string;
  keywords: string[];
};

export type CaseChecklist = Record<Phase, ChecklistItem[]>;

export type CaseTemplate = {
  id: string;
  fachrichtung: string;

  /** optional: für Innere-Unterfächer (z.B. Kardiologie, Gastro, ...) */
  subfach?: string;

  title: string;
  vignette: string;
  startQuestion: string;
  checklist: CaseChecklist;
};

/**
 * Wichtig:
 * In deiner Fachrichtungs-Liste gibt es teils "Innere-nahe" Schwerpunkte
 * (Kardiologie, Gastro, ...). Für die Case-Logik behandeln wir die als:
 * fachrichtung = "Innere Medizin" + subfach = "<Schwerpunkt>"
 */
const INNERE_SUBFACH_VALUES = [
  "Kardiologie",
  "Pneumologie",
  "Gastroenterologie",
  "Nephrologie",
  "Endokrinologie/Diabetologie",
  "Hämatologie/Onkologie",
  "Infektiologie",
  "Rheumatologie",
  "Geriatrie",
] as const;

function isInnereSubfachValue(v: string) {
  return (INNERE_SUBFACH_VALUES as readonly string[]).includes(v);
}

export function resolveCfgForCases(cfg: SessionConfig): { fachrichtung: string; innereSubfach: string } {
  const fach = String(cfg?.fachrichtung ?? "Innere Medizin").trim() || "Innere Medizin";

  // Wenn User "Kardiologie" als Fachrichtung gewählt hat, mappen wir:
  // -> Innere Medizin + subfach=Kardiologie
  if (isInnereSubfachValue(fach)) {
    return { fachrichtung: "Innere Medizin", innereSubfach: fach };
  }

  const subRaw = String((cfg as any)?.innereSubfach ?? "all").trim();
  const sub = subRaw.length ? subRaw : "all";
  return { fachrichtung: fach, innereSubfach: sub };
}

/** Gibt Fälle für eine (ggf. gemappte) Konfig zurück. Kann leer sein. */
export function getCasesForCfg(cfg: SessionConfig): CaseTemplate[] {
  const r = resolveCfgForCases(cfg);

  let pool = ALL_CASES.filter((c) => c.fachrichtung === r.fachrichtung);

  // Innere-Unterfach einschränken, wenn gesetzt
  if (r.fachrichtung === "Innere Medizin" && r.innereSubfach !== "all") {
    const subPool = pool.filter((c) => String(c.subfach ?? "") === r.innereSubfach);
    // Nur wenn es wirklich Treffer gibt, einschränken (sonst lieber "alle Innere")
    if (subPool.length) pool = subPool;
  }

  return pool;
}

export function hasAnyCasesForFach(fachrichtung: string): boolean {
  const f = String(fachrichtung ?? "").trim();
  if (!f) return false;

  // auch hier: Schwerpunkt als Innere interpretieren
  if (isInnereSubfachValue(f)) return ALL_CASES.some((c) => c.fachrichtung === "Innere Medizin" && c.subfach === f);

  return ALL_CASES.some((c) => c.fachrichtung === f);
}

export function hasCasesForCfg(cfg: SessionConfig): boolean {
  return getCasesForCfg(cfg).length > 0;
}

export const ALL_CASES: CaseTemplate[] = [
  // -----------------------
  // Bestehende Fälle
  // -----------------------
  {
    id: "im-thorax-1",
    fachrichtung: "Innere Medizin",
    subfach: "Kardiologie",
    title: "Akuter Thoraxschmerz",
    vignette:
      "52-jähriger Patient mit plötzlich einsetzendem Thoraxschmerz, kaltschweißig, wirkt ängstlich. RR 150/90, HF 105.",
    startQuestion: "Starte: Welche 3 Dinge klärst du sofort (Anamnese/Untersuchung/Monitoring)?",
    checklist: {
      intro: [
        { label: "ABCDE / Vitalparameter", keywords: ["abcde", "vital", "rr", "puls", "hf", "af", "spo2", "sätt", "temper"] },
        { label: "Monitoring / EKG", keywords: ["monitor", "ekg", "12-kanal", "telemetrie"] },
        { label: "i.v. Zugang / O2 / Schmerz", keywords: ["zugang", "iv", "o2", "sauerstoff", "analges", "schmerzther"] },
        { label: "Schmerzcharakter & Beginn", keywords: ["beginn", "plötzlich", "dauer", "charakter", "ausstrahl", "druck", "brenn"] },
      ],
      ddx: [
        { label: "ACS / Myokardinfarkt", keywords: ["acs", "infarkt", "mi", "nstemi", "stemi", "koronar", "angina"] },
        { label: "Aortendissektion", keywords: ["dissektion", "aorta"] },
        { label: "Lungenembolie", keywords: ["lungenembolie", "le", "embolie"] },
        { label: "Pneumothorax", keywords: ["pneumothorax", "pneumo"] },
        { label: "Perikarditis", keywords: ["perikard", "perikarditis"] },
      ],
      diagnostics: [
        { label: "EKG", keywords: ["ekg"] },
        { label: "Troponin", keywords: ["troponin"] },
        { label: "Labor (BB/CRP/etc.)", keywords: ["labor", "bb", "crp", "elektrolyt", "krea", "glukose"] },
        { label: "Röntgen/CT (je nach DDx)", keywords: ["röntgen", "ct", "cta", "angio"] },
        { label: "Echo/Ultraschall", keywords: ["echo", "sono", "tte"] },
      ],
      management: [
        { label: "Sofort: O2/Monitoring/Zugang", keywords: ["o2", "sauerstoff", "monitor", "zugang", "iv"] },
        { label: "ACS-Therapie/Notfallpfad", keywords: ["assa", "heparin", "nitro", "morphin", "katheter", "kardiolog", "stemi"] },
        { label: "Bei Dissektion: RR/Schmerz kontrollieren", keywords: ["rr", "senken", "beta", "esmolol", "labetal", "analges"] },
      ],
      closing: [
        { label: "1 Satz Problem + Risiko", keywords: ["wahrscheinlich", "problem", "gefähr", "risiko", "instabil"] },
        { label: "1 nächster Schritt", keywords: ["als nächstes", "nächster", "next", "schritt", "jetzt"] },
      ],
    },
  },

  {
    id: "im-dyspnoe-1",
    fachrichtung: "Innere Medizin",
    subfach: "Pneumologie",
    title: "Akute Dyspnoe",
    vignette: "68-jährige Patientin mit akuter Luftnot, SpO2 88% in Raumluft, HF 112, AF 28.",
    startQuestion: "Was ist dein erster strukturierter Ansatz (ABCDE) – und welche Red Flags suchst du?",
    checklist: {
      intro: [
        { label: "ABCDE / Vitalparameter", keywords: ["abcde", "vital", "rr", "puls", "hf", "af", "spo2", "sätt", "temper"] },
        { label: "O2/Monitoring sofort", keywords: ["o2", "sauerstoff", "monitor", "spo2"] },
        { label: "Auskultation / klinische Zeichen", keywords: ["auskult", "rassel", "giemen", "wheez", "stridor", "zyanose", "arbeit"] },
      ],
      ddx: [
        { label: "Pneumonie", keywords: ["pneumonie", "pneumonia"] },
        { label: "Lungenödem / Herzinsuffizienz", keywords: ["ödem", "lungenödem", "hi", "herzinsuff", "stauung"] },
        { label: "COPD/Asthma-Exazerbation", keywords: ["copd", "asthma", "exazerb", "broncho"] },
        { label: "Lungenembolie", keywords: ["lungenembolie", "le", "embolie"] },
        { label: "Pneumothorax", keywords: ["pneumothorax", "pneumo"] },
      ],
      diagnostics: [
        { label: "BGA / SpO2 Verlauf", keywords: ["bga", "blutgas", "spo2"] },
        { label: "Röntgen Thorax", keywords: ["röntgen", "thorax"] },
        { label: "EKG", keywords: ["ekg"] },
        { label: "Labor (CRP/BB/BNP/D-Dimer je nach DDx)", keywords: ["crp", "bb", "bnp", "d-dimer", "troponin", "labor"] },
      ],
      management: [
        { label: "Sofort: O2, ggf. NIV", keywords: ["o2", "sauerstoff", "niv", "cpap", "bipap"] },
        { label: "Bronchodilatatoren bei obstruktiv", keywords: ["salbutamol", "beta2", "ipratrop", "broncho", "steroid"] },
        { label: "Diuretika/Nitro bei Lungenödem", keywords: ["furo", "diuret", "nitro", "ödem"] },
        { label: "AB bei Pneumonie/Sepsis", keywords: ["antibio", "sepsis", "kultur", "laktat"] },
      ],
      closing: [
        { label: "1 Satz Problem + Risiko", keywords: ["hypox", "resp", "gefähr", "instabil", "risiko"] },
        { label: "1 nächster Schritt", keywords: ["als nächstes", "nächster", "schritt", "jetzt"] },
      ],
    },
  },

  {
    id: "ch-appendix-1",
    fachrichtung: "Chirurgie",
    title: "Akutes Abdomen (RLQ)",
    vignette:
      "24-jährige Person mit rechtsseitigen Unterbauchschmerzen, Übelkeit, subfebril. Druckschmerz im rechten Unterbauch.",
    startQuestion: "Welche 3 wichtigsten DDx nennst du – und wie gehst du diagnostisch vor?",
    checklist: {
      intro: [
        { label: "Vitalparameter / Red Flags", keywords: ["rr", "puls", "hf", "af", "fieber", "sepsis", "instabil"] },
        { label: "Abdomenstatus", keywords: ["abdomen", "druck", "loslass", "periton", "abwehr", "palp"] },
        { label: "Schwangerschaft/Genital/Urin", keywords: ["schwanger", "ss", "hcg", "urin", "dysurie", "gyn"] },
      ],
      ddx: [
        { label: "Appendizitis", keywords: ["append", "appendizitis"] },
        { label: "Gyn: Extrauteringravidität / Ovar-Torsion", keywords: ["extrauter", "eug", "torsion", "ovar"] },
        { label: "HWI/Stein", keywords: ["hwi", "zystitis", "stein", "kolik", "urolith"] },
        { label: "Gastroenteritis/Ileitis", keywords: ["gastro", "enteritis", "ileitis", "crohn"] },
      ],
      diagnostics: [
        { label: "Labor (BB/CRP)", keywords: ["labor", "bb", "crp", "leuko"] },
        { label: "Urinstatus / Schwangerschaftstest", keywords: ["urin", "hcg", "schwanger", "test"] },
        { label: "Sono Abdomen", keywords: ["sono", "ultraschall"] },
        { label: "CT (wenn unklar)", keywords: ["ct"] },
      ],
      management: [
        { label: "NPO + i.v. Zugang/Flüssigkeit", keywords: ["npo", "nüchtern", "zugang", "iv", "volumen", "flüssig"] },
        { label: "Analgesie", keywords: ["analges", "schmerz"] },
        { label: "Chirurgie-Konsil / OP-Pfad", keywords: ["chirurg", "op", "laparo", "konsil"] },
        { label: "AB (je nach Befund)", keywords: ["antibio", "ab"] },
      ],
      closing: [
        { label: "1 Satz Problem + Risiko", keywords: ["append", "periton", "perfor", "risiko"] },
        { label: "1 nächster Schritt", keywords: ["als nächstes", "nächster", "schritt", "jetzt"] },
      ],
    },
  },

  {
    id: "ped-fieber-1",
    fachrichtung: "Pädiatrie",
    title: "Fieber bei Kleinkind",
    vignette: "2-jähriges Kind mit Fieber 39,5°C seit 24h, trinkt schlechter, wirkt müde.",
    startQuestion: "Welche Red Flags fragst/prüfst du – und was sind deine nächsten Schritte?",
    checklist: {
      intro: [
        { label: "Allgemeinzustand / Vigilanz", keywords: ["apath", "somnol", "vigil", "reizbar", "schlapp", "bewusst"] },
        { label: "Sepsis/Meningitis Red Flags", keywords: ["petech", "mening", "nacken", "krampf", "sepsis"] },
        { label: "Hydratation", keywords: ["trinken", "dehyd", "diurese", "windel"] },
        { label: "Vitalparameter", keywords: ["rr", "puls", "hf", "af", "spo2", "temper"] },
      ],
      ddx: [
        { label: "Viral", keywords: ["viral", "infekt"] },
        { label: "HWI", keywords: ["hwi", "urin", "zystitis", "pyelo"] },
        { label: "Pneumonie", keywords: ["pneumonie", "husten", "auskult"] },
        { label: "Meningitis", keywords: ["mening", "nacken", "photophob"] },
      ],
      diagnostics: [
        { label: "Urin (Stix/Urinkultur)", keywords: ["urin", "stix", "kultur"] },
        { label: "Labor (CRP/BB)", keywords: ["crp", "bb", "labor", "leuko"] },
        { label: "Klinische Untersuchung Fokus", keywords: ["otoskop", "rachen", "lunge", "auskult"] },
      ],
      management: [
        { label: "Antipyrese + Flüssigkeit", keywords: ["paracetamol", "ibu", "antipy", "flüssig", "hydr"] },
        { label: "Bei Red Flags: Sepsis-Workup + i.v. AB", keywords: ["sepsis", "zugang", "iv", "antibio", "kultur", "laktat"] },
        { label: "Sicherheitsnetz/Verlauf", keywords: ["wiederkommen", "kontrolle", "warnzeichen", "verlauf"] },
      ],
      closing: [
        { label: "1 Satz Problem + Risiko", keywords: ["fieber", "risiko", "dehyd", "sepsis"] },
        { label: "1 nächster Schritt", keywords: ["als nächstes", "nächster", "schritt", "jetzt"] },
      ],
    },
  },

  // -----------------------
  // Case Pack 1 (VivaMed) – NEUE Fälle
  // -----------------------
  {
    id: "im-sepsis-1",
    fachrichtung: "Innere Medizin",
    subfach: "Infektiologie",
    title: "Sepsis (Pneumonie-Verdacht)",
    vignette:
      "72-jähriger Patient, Fieber 39,2°C, Schüttelfrost, Verwirrtheit. RR 92/58, HF 118, AF 26, SpO2 91% RA.",
    startQuestion: "Du bist in der ZNA: Was machst du in den ersten 2 Minuten (Stichpunkte)?",
    checklist: {
      intro: [
        { label: "ABCDE / Vitalparameter", keywords: ["abcde", "vital", "rr", "puls", "hf", "af", "spo2", "sätt", "temper"] },
        { label: "Sepsis/Schock erkennen", keywords: ["sepsis", "schock", "hypoton", "laktat", "qsofa"] },
        { label: "Monitoring + i.v. Zugang", keywords: ["monitor", "zugang", "iv"] },
        { label: "O2 bei Hypoxie", keywords: ["o2", "sauerstoff"] },
      ],
      ddx: [
        { label: "Pneumonie", keywords: ["pneumonie", "auskult", "husten"] },
        { label: "Harnwegsinfekt/Pyelonephritis", keywords: ["hwi", "pyelo", "flank", "urin"] },
        { label: "Abdomineller Fokus", keywords: ["abdomen", "chole", "append", "periton"] },
      ],
      diagnostics: [
        { label: "BGA/Laktat", keywords: ["bga", "laktat"] },
        { label: "Blutkulturen (vor AB)", keywords: ["blutkultur", "kulturen"] },
        { label: "Labor (BB/CRP/PCT/Nierenwerte)", keywords: ["bb", "crp", "pct", "prokal", "krea", "harnstoff", "labor"] },
        { label: "Röntgen Thorax", keywords: ["röntgen", "thorax"] },
      ],
      management: [
        { label: "Flüssigkeitsbolus", keywords: ["bolus", "volumen", "flüssig", "ringer", "nacl"] },
        { label: "i.v. Antibiotika früh", keywords: ["antibio", "iv", "breit", "sepsis"] },
        { label: "Vasopressor bei persistierender Hypotonie", keywords: ["noradren", "vasopress", "katechol"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["sepsis", "schock", "instabil", "risiko"] },
        { label: "Nächster Schritt", keywords: ["icu", "intensiv", "überwach", "als nächstes", "schritt"] },
      ],
    },
  },

  {
    id: "im-gibleed-1",
    fachrichtung: "Innere Medizin",
    subfach: "Gastroenterologie",
    title: "Obere GI-Blutung (Meläna)",
    vignette:
      "58-jährige Person mit Schwindel, Meläna seit heute Morgen. RR 88/55, HF 124, blass, kaltschweißig.",
    startQuestion: "Wie gehst du vor (Stabilisierung zuerst) – nenne 4 Schritte.",
    checklist: {
      intro: [
        { label: "ABCDE / Schock erkennen", keywords: ["abcde", "schock", "hypoton", "rr", "puls", "hf"] },
        { label: "2 großlumige Zugänge", keywords: ["2", "zwei", "großlum", "zugang"] },
        { label: "Monitoring", keywords: ["monitor", "ekg", "spo2"] },
        { label: "Blutgruppe/Kreuzprobe", keywords: ["kreuz", "blutgruppe", "crossmatch"] },
      ],
      ddx: [
        { label: "Ulcus-Blutung", keywords: ["ulcus", "pept", "pud"] },
        { label: "Varizenblutung", keywords: ["varizen", "zirrh", "portal"] },
        { label: "Mallory-Weiss", keywords: ["mallory", "weiss"] },
      ],
      diagnostics: [
        { label: "Labor (Hb/INR/Thrombozyten)", keywords: ["hb", "inr", "quick", "thrombo", "labor"] },
        { label: "Endoskopie organisieren", keywords: ["endo", "gastroskop", "notfallendo"] },
      ],
      management: [
        { label: "Volumen / Blutprodukte nach Bedarf", keywords: ["volumen", "ek", "transfu", "blut"] },
        { label: "PPI i.v.", keywords: ["ppi", "pantopraz", "omepraz"] },
        { label: "Bei Varizen: Octreotid + AB", keywords: ["octre", "terlip", "antibio", "ceftria"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["blutung", "schock", "instabil", "risiko"] },
        { label: "Nächster Schritt", keywords: ["endo", "icu", "überwach", "als nächstes", "schritt"] },
      ],
    },
  },

  {
    id: "im-dka-1",
    fachrichtung: "Innere Medizin",
    subfach: "Endokrinologie/Diabetologie",
    title: "Diabetische Ketoazidose (DKA)",
    vignette:
      "23-jährige Person mit Übelkeit, Bauchschmerzen, Kussmaul-Atmung, starkem Durst. Glukose 420 mg/dl, AF 30, RR 105/65.",
    startQuestion: "Welche Diagnostik bestätigst du sofort – und wie startest du die Therapie (Reihenfolge)?",
    checklist: {
      intro: [
        { label: "ABCDE / Dehydratation einschätzen", keywords: ["abcde", "dehyd", "tachy", "vital", "rr", "puls", "af"] },
        { label: "Bewusstseinslage", keywords: ["vigil", "somnol", "bewusst"] },
      ],
      ddx: [
        { label: "DKA", keywords: ["dka", "keto", "anionen"] },
        { label: "HHS", keywords: ["hhs", "hyperosmol"] },
        { label: "Sepsis als Trigger", keywords: ["sepsis", "infekt", "pneumonie", "hwi"] },
      ],
      diagnostics: [
        { label: "BGA / pH", keywords: ["bga", "ph"] },
        { label: "Ketone", keywords: ["keton", "beta-hydroxy"] },
        { label: "Elektrolyte (K+!)", keywords: ["kalium", "k+", "elektrolyt"] },
        { label: "Anion Gap", keywords: ["anion", "gap"] },
      ],
      management: [
        { label: "Flüssigkeit zuerst", keywords: ["flüssig", "volumen", "ringer", "nacl"] },
        { label: "Insulin i.v. (nach K+ Check)", keywords: ["insulin", "iv", "perfusor"] },
        { label: "Kalium-Management", keywords: ["kalium", "k+", "substitu"] },
        { label: "Trigger behandeln", keywords: ["infekt", "antibio", "ursache"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["azid", "dka", "dehyd", "risiko"] },
        { label: "Nächster Schritt", keywords: ["monitor", "icu", "bga", "kontrolle", "schritt"] },
      ],
    },
  },

  {
    id: "im-syncope-1",
    fachrichtung: "Innere Medizin",
    subfach: "Kardiologie",
    title: "Synkope (Red Flags)",
    vignette:
      "46-jährige Person, kurz bewusstlos geworden im Supermarkt, jetzt wieder wach. Leichtes Herzrasen vorher. Keine Schmerzen aktuell.",
    startQuestion: "Welche 5 Red Flags fragst/prüfst du sofort (Stichpunkte)?",
    checklist: {
      intro: [
        { label: "Vitalparameter", keywords: ["rr", "puls", "hf", "spo2", "af"] },
        { label: "Trauma/Verletzung checken", keywords: ["sturz", "trauma", "kopf", "verletz"] },
        { label: "EKG/Monitoring", keywords: ["ekg", "monitor"] },
      ],
      ddx: [
        { label: "Arrhythmie", keywords: ["arrh", "tachy", "brady", "av-block", "vt"] },
        { label: "Vasovagal/Orthostase", keywords: ["vaso", "orthostat", "dehyd", "aufstehen"] },
        { label: "PE / kardiale Ursache", keywords: ["embolie", "pe", "lunge", "klappe", "aortenstenose"] },
        { label: "Blutung/Anämie", keywords: ["blutung", "anäm", "hb", "meläna"] },
      ],
      diagnostics: [
        { label: "EKG", keywords: ["ekg"] },
        { label: "Orthostase-Test", keywords: ["orthostat", "schellong"] },
        { label: "Labor (Hb/Elyte/Glukose)", keywords: ["hb", "elektro", "gluk", "labor"] },
      ],
      management: [
        { label: "Bei Red Flags: stationär/Monitoring", keywords: ["station", "monitor", "überwach"] },
        { label: "Flüssigkeit bei Orthostase", keywords: ["flüssig", "volumen"] },
        { label: "Arrhythmie-Pfad", keywords: ["kardiolog", "antiarrh", "kardioversion"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["synkope", "red flag", "risiko"] },
        { label: "Nächster Schritt", keywords: ["monitor", "ekg", "schritt", "als nächstes"] },
      ],
    },
  },

  {
    id: "im-hyperk-1",
    fachrichtung: "Innere Medizin",
    subfach: "Nephrologie",
    title: "Hyperkaliämie",
    vignette: "70-jährige Person mit Niereninsuffizienz, Muskelschwäche. K+ 6,8 mmol/l. EKG noch nicht gemacht.",
    startQuestion: "Was ist JETZT dein Vorgehen in Reihenfolge (3–5 Schritte)?",
    checklist: {
      intro: [
        { label: "Monitoring", keywords: ["monitor", "ekg", "telemetrie"] },
        { label: "Gefahr erkennen (K+ hoch)", keywords: ["hyperkal", "k+", "6", "arrh"] },
      ],
      ddx: [
        { label: "Nierenversagen", keywords: ["niere", "krea", "dialyse", "anurie"] },
        { label: "Medikamente (ACE/ARB/Spironolacton)", keywords: ["ace", "arb", "spirono", "kaliumspar", "trimeth"] },
        { label: "Azidose/Gewebszerfall", keywords: ["azid", "rhabdo", "hämoly"] },
      ],
      diagnostics: [
        { label: "EKG sofort", keywords: ["ekg"] },
        { label: "Kontroll-Labor (K+ verifizieren)", keywords: ["kontroll", "labor", "kalium"] },
        { label: "BGA/Azidose", keywords: ["bga", "azid", "ph"] },
      ],
      management: [
        { label: "Calcium i.v. bei EKG-Veränderungen", keywords: ["calcium", "gluconat", "calciumgluk"] },
        { label: "Shift: Insulin + Glukose", keywords: ["insulin", "glukose", "dextrose"] },
        { label: "Beta2/Salbutamol", keywords: ["salbutamol", "beta2"] },
        { label: "Elimination: Diuretika/Resonium/Dialyse", keywords: ["diuret", "furo", "resonium", "dialyse"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["hyperkal", "arrh", "stillstand", "risiko"] },
        { label: "Nächster Schritt", keywords: ["monitor", "kontrolle", "schritt"] },
      ],
    },
  },

  {
    id: "ch-chole-1",
    fachrichtung: "Chirurgie",
    title: "Akute Cholezystitis",
    vignette:
      "45-jährige Person mit rechtsseitigen Oberbauchschmerzen, Fieber 38,5°C, Murphy positiv, Übelkeit.",
    startQuestion: "Nenne DDx + Diagnostik + erstes Management (kurz, strukturiert).",
    checklist: {
      intro: [
        { label: "Vitalparameter / Sepsiszeichen", keywords: ["rr", "puls", "hf", "fieber", "sepsis"] },
        { label: "Abdomenstatus / Murphy", keywords: ["murphy", "oberbauch", "druck", "periton"] },
      ],
      ddx: [
        { label: "Cholezystitis", keywords: ["chole", "cholezyst"] },
        { label: "Choledocholithiasis/Cholangitis", keywords: ["choledoch", "cholang", "ikter"] },
        { label: "Pankreatitis", keywords: ["pankreat", "lipase"] },
      ],
      diagnostics: [
        { label: "Labor (CRP/Leuko/Leberwerte)", keywords: ["crp", "leuko", "gpt", "got", "ap", "bilir", "labor"] },
        { label: "Sono Oberbauch", keywords: ["sono", "ultraschall"] },
        { label: "Bei unklar: CT/MRCP", keywords: ["ct", "mrcp"] },
      ],
      management: [
        { label: "NPO + i.v. Flüssigkeit", keywords: ["npo", "nüchtern", "iv", "flüssig"] },
        { label: "Analgesie", keywords: ["analges", "schmerz"] },
        { label: "Antibiotika (bei Entzündung)", keywords: ["antibio", "ab"] },
        { label: "Chirurgie/OP-Plan (Lap. Chole)", keywords: ["op", "laparo", "cholezystekt", "konsil"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["chole", "perfor", "cholang", "risiko"] },
        { label: "Nächster Schritt", keywords: ["op", "station", "schritt", "als nächstes"] },
      ],
    },
  },

  {
    id: "ch-ileus-1",
    fachrichtung: "Chirurgie",
    title: "Ileus (mechanisch?)",
    vignette:
      "68-jährige Person mit kolikartigen Bauchschmerzen, Erbrechen, kein Stuhl/Gas seit 24h, geblähter Bauch.",
    startQuestion: "Wie gehst du vor – Stabilisierung, Diagnostik, Management (Stichpunkte)?",
    checklist: {
      intro: [
        { label: "Vitalparameter / Schockzeichen", keywords: ["rr", "puls", "hf", "schock", "instabil"] },
        { label: "Abdomenstatus / Peritonitis?", keywords: ["periton", "abwehr", "loslass", "abdomen"] },
        { label: "NPO + i.v. Zugang", keywords: ["npo", "nüchtern", "zugang", "iv"] },
      ],
      ddx: [
        { label: "Mechanischer Ileus", keywords: ["mechan", "ileus", "obstruk"] },
        { label: "Pseudoileus", keywords: ["pseudo", "paralyt"] },
        { label: "Inkarzeration/Briden", keywords: ["briden", "adhäs", "hern", "inkarz"] },
      ],
      diagnostics: [
        { label: "Labor (Entzündung/Elyte)", keywords: ["labor", "crp", "leuko", "elektro"] },
        { label: "CT Abdomen", keywords: ["ct"] },
        { label: "Röntgen Abdomen", keywords: ["röntgen", "abdomen"] },
      ],
      management: [
        { label: "Magensonde / Dekompression", keywords: ["magensonde", "ng", "dekompr"] },
        { label: "Volumen/Elektrolyte korrigieren", keywords: ["volumen", "flüssig", "elektro", "kalium"] },
        { label: "Chirurgie/OP bei Strangulation/Peritonitis", keywords: ["op", "strang", "periton", "notfall"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["ileus", "ischäm", "perfor", "risiko"] },
        { label: "Nächster Schritt", keywords: ["ct", "op", "station", "schritt"] },
      ],
    },
  },

  {
    id: "ch-trauma-1",
    fachrichtung: "Chirurgie",
    title: "Polytrauma / hämorrhagischer Schock",
    vignette:
      "Junger Patient nach Motorradunfall, blass, kaltschweißig, RR 80/50, HF 135, GCS 13, Bauch druckschmerzhaft.",
    startQuestion: "Wie ist dein Vorgehen nach ABCDE – und was machst du sofort gegen den Schock?",
    checklist: {
      intro: [
        { label: "ABCDE konsequent", keywords: ["abcde", "airway", "breathing", "circulation"] },
        { label: "Blutung/Schock erkennen", keywords: ["schock", "blutung", "hypoton", "tachy"] },
        { label: "O2 + Monitoring + Zugänge", keywords: ["o2", "monitor", "zugang", "iv"] },
      ],
      ddx: [
        { label: "Blutung Abdomen", keywords: ["abdomen", "intraabdomin", "milz", "leber"] },
        { label: "Thoraxtrauma (Pneu/Hämatothorax)", keywords: ["pneumo", "hämatoth", "thorax"] },
        { label: "Beckenblutung", keywords: ["becken", "pelvic"] },
      ],
      diagnostics: [
        { label: "FAST/Notfallsono", keywords: ["fast", "sono", "ultraschall"] },
        { label: "Trauma-CT (wenn stabil)", keywords: ["ct", "trauma-ct", "polytrauma"] },
        { label: "Labor/Blutgruppe", keywords: ["labor", "hb", "gerinn", "kreuz", "blutgruppe"] },
      ],
      management: [
        { label: "Volumen/Transfusion (Massive Transfusion)", keywords: ["transfu", "ek", "massiv", "blut"] },
        { label: "Beckenstabilisierung (Binder) falls nötig", keywords: ["binder", "becken"] },
        { label: "Chirurgische Blutstillung / OP", keywords: ["op", "laparo", "blutstill", "intervention"] },
      ],
      closing: [
        { label: "Problem + Risiko", keywords: ["schock", "blutung", "instabil", "risiko"] },
        { label: "Nächster Schritt", keywords: ["op", "ct", "icu", "schritt"] },
      ],
    },
  },
];

export function getCaseById(id: string | undefined | null) {
  if (!id) return undefined;
  return ALL_CASES.find((c) => c.id === id);
}

/**
 * Wählt einen Fall passend zur (gemappten) Konfig aus.
 * Falls es für das Fach keine Fälle gibt → fallback: ALL_CASES.
 */
export function pickCase(cfg: SessionConfig): CaseTemplate {
  const pool = getCasesForCfg(cfg);
  const source = pool.length ? pool : ALL_CASES;
  return source[Math.floor(Math.random() * source.length)];
}

export function phaseForTurn(userTurns: number): Phase {
  if (userTurns <= 0) return "intro";
  if (userTurns === 1) return "ddx";
  if (userTurns === 2) return "diagnostics";
  if (userTurns === 3) return "management";
  return "closing";
}

export function secondsPerTurn(difficulty: number): number {
  if (difficulty >= 80) return 35;
  if (difficulty >= 60) return 45;
  if (difficulty >= 35) return 55;
  return 70;
}
