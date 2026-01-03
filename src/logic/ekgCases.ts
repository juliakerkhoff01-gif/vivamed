export type EkgCategory = "ACS" | "Rhythmus" | "Block" | "Elektrolyt" | "Hypertrophie" | "Spezial";

export type EkgCase = {
  id: string;
  title: string;
  category: EkgCategory;
  tags: string[];

  /** Kurz-Szenario (1–2 Sätze) */
  prompt: string;

  /** Was soll man im EKG sehen / prüfen (Checkliste) */
  keyFindings: string[];

  /** Interpretation / Diagnose */
  interpretation: string;

  /** Was sagt man „prüfungsreif“? */
  report: string;

  /** Management / nächste Schritte (kurz, M3-tauglich) */
  management: string[];

  /** Red Flags / Fallen */
  redFlags: string[];

  /** Typische Prüfungsfragen */
  examQuestions: string[];
};

export const EKG_CATEGORIES: { id: EkgCategory; label: string }[] = [
  { id: "ACS", label: "ACS" },
  { id: "Rhythmus", label: "Rhythmus" },
  { id: "Block", label: "Block" },
  { id: "Elektrolyt", label: "Elektrolyt" },
  { id: "Hypertrophie", label: "Hypertrophie" },
  { id: "Spezial", label: "Spezial" },
];

export const EKG_CASES: EkgCase[] = [
  {
    id: "af_rapid",
    title: "Vorhofflimmern (tachykard)",
    category: "Rhythmus",
    tags: ["unregelmäßig", "keine P-Wellen", "HF 140–170"],
    prompt: "Unregelmäßig-unregelmäßiger Puls, Palpitationen. EKG: Tachykardie.",
    keyFindings: [
      "RR absolut arrhythmisch",
      "keine klaren P-Wellen, flimmernde Grundlinie",
      "schmale QRS-Komplexe (meist)",
      "Frequenz typischerweise > 110/min",
    ],
    interpretation: "Vorhofflimmern mit schneller Überleitung (tachykardes VHF).",
    report:
      "Unregelmäßiger, absolut arrhythmischer Rhythmus ohne P-Wellen, schmale QRS-Komplexe. Kammerfrequenz ca. 150/min. Befund vereinbar mit Vorhofflimmern mit schneller Überleitung.",
    management: [
      "Stabil? Wenn instabil: elektrische Kardioversion",
      "Wenn stabil: Frequenzkontrolle (z.B. Betablocker / Verapamil je nach Situation)",
      "Antikoagulations-Check (CHA₂DS₂-VASc), Dauer/Timing klären",
      "Auslöser suchen (Infekt, Hyperthyreose, Alkohol, Elektrolyte)",
    ],
    redFlags: ["Hypotonie, ACS, Lungenödem, Schock → sofortige Kardioversion", "WPW-Verdacht: keine AV-Blocker"],
    examQuestions: [
      "Wann kardiovertierst du elektrisch?",
      "Wie gehst du bzgl. Antikoagulation vor (Dauer < / > 48h)?",
      "Welche Ursachen musst du abklären?",
    ],
  },
  {
    id: "svt_avnrt",
    title: "AVNRT (paroxysmale SVT)",
    category: "Rhythmus",
    tags: ["regelmäßig", "schmal", "HF 160–220"],
    prompt: "Plötzlicher Beginn/Ende von Herzrasen. EKG: schmale, regelmäßige Tachykardie.",
    keyFindings: [
      "regelmäßige schmale Tachykardie",
      "P-Wellen oft nicht sichtbar oder retrograd (Pseudo-r' in V1 / Pseudo-S in II/III/aVF)",
      "plötzlicher Beginn/Ende typisch",
    ],
    interpretation: "AV-Knoten-Reentrytachykardie (AVNRT) wahrscheinlich.",
    report:
      "Regelmäßige schmale Tachykardie (ca. 180/min), P-Wellen nicht sicher abgrenzbar/retrograd. Bild passend zu einer paroxysmalen supraventrikulären Tachykardie, am ehesten AVNRT.",
    management: [
      "Stabil? Wenn instabil: synchronisierte Kardioversion",
      "Vagale Manöver",
      "Adenosin i.v. (Kontraindikationen beachten)",
      "Langfristig: Betablocker / Ablation bei Rezidiven",
    ],
    redFlags: ["Breitkomplex bei unklarer Tachykardie → wie VT behandeln", "Asthma/COPD: Adenosin vorsichtig"],
    examQuestions: ["Welche vagalen Manöver kennst du?", "Wann gibst du Adenosin, wann kardiovertierst du?"],
  },
  {
    id: "vt_monomorphic",
    title: "Monomorphe ventrikuläre Tachykardie",
    category: "Rhythmus",
    tags: ["breit", "regelmäßig", "AV-Dissoziation"],
    prompt: "Synkopen/Schwindel. EKG: breite, regelmäßige Tachykardie.",
    keyFindings: [
      "breite QRS-Komplexe (≥ 120 ms)",
      "regelmäßige Tachykardie",
      "Hinweise auf AV-Dissoziation (Capture/ Fusion Beats) möglich",
      "Extremachsen möglich",
    ],
    interpretation: "Bis zum Beweis des Gegenteils VT.",
    report:
      "Regelmäßige Breitkomplextachykardie (QRS deutlich verbreitert). Befund hochgradig verdächtig auf ventrikuläre Tachykardie bis zum Beweis des Gegenteils.",
    management: [
      "ABCDE, Monitoring, i.v.-Zugang",
      "Instabil: synchronisierte Kardioversion",
      "Stabil: Antiarrhythmikum (z.B. Amiodaron) nach lokalem Standard",
      "Ursachen: Ischämie, Elektrolyte, Medikamente",
    ],
    redFlags: ["Bei Unklarheit breit + regelmäßig → VT behandeln", "Schockzeichen → sofort kardiovertieren"],
    examQuestions: ["Wie erkennst du AV-Dissoziation?", "Therapie bei stabil/instabil?"],
  },
  {
    id: "stemi_anterior",
    title: "STEMI anteroseptal",
    category: "ACS",
    tags: ["ST-Hebung", "V1–V4", "reperfusionspflichtig"],
    prompt: "Thoraxschmerz, kaltschweißig. EKG zeigt ST-Hebungen in den Vorderwandableitungen.",
    keyFindings: [
      "ST-Hebungen in V1–V4 (typisch anteroseptal)",
      "reziproke ST-Senkungen möglich",
      "ggf. neue Q-Zacken / R-Verlust",
    ],
    interpretation: "Akuter STEMI (Vorderwand) → sofortige Reperfusion.",
    report:
      "ST-Hebungen anteroseptal (V1–V4), vereinbar mit akutem STEMI. Reperfusionspflichtiger Befund.",
    management: [
      "ACS-Protokoll nach Standard (Monitoring, Zugang, Analgesie)",
      "Sofort Reperfusion (PCI) organisieren",
      "Troponin/Labor, aber Therapie nicht verzögern",
      "Komplikationen: Rhythmusstörungen, Pumpversagen",
    ],
    redFlags: ["Zeitkritisch: Door-to-balloon / Alarm", "STEMI-Äquivalente kennen (z.B. posterior)"],
    examQuestions: ["Welche STEMI-Kriterien? Was sind STEMI-Äquivalente?", "Welche Ableitungen sprechen für welche Wand?"],
  },
  {
    id: "nstemi_st_depression",
    title: "NSTEMI/Ischämie (ST-Senkungen)",
    category: "ACS",
    tags: ["ST-Senkung", "T-Inversion", "Risiko"],
    prompt: "Thoraxdruck, Troponin kann noch negativ sein. EKG: ST-Senkungen/T-Negativierungen.",
    keyFindings: [
      "horizontale oder deszendierende ST-Senkungen",
      "T-Negativierungen möglich",
      "kein STEMI-Kriterium, aber Ischämiezeichen",
    ],
    interpretation: "Myokardischämie; klinisch NSTEMI/UA abklären.",
    report:
      "ST-Senkungen und/oder T-Inversionen als Ischämiezeichen, kein STEMI-Muster. Klinische Korrelation und ACS-Diagnostik erforderlich.",
    management: [
      "ACS-Algorithmus (Risikostratifizierung, Serientroponin)",
      "Antithrombotische Therapie nach Standard/Leitlinie",
      "Zeitnahe Koronarangiographie je nach Risiko",
    ],
    redFlags: ["Starke ST-Senkungen in V1–V3 → posterioren Infarkt mitdenken", "Symptome/Instabilität zählt!"],
    examQuestions: ["Wie unterscheidest du STEMI vs NSTEMI?", "Was ist ein posteriorer Infarkt im EKG?"],
  },
  {
    id: "avblock_3",
    title: "AV-Block III°",
    category: "Block",
    tags: ["AV-Dissoziation", "Bradykardie", "Ersatzrhythmus"],
    prompt: "Bradykardie, Schwindel, ggf. Synkope. EKG zeigt Dissoziation.",
    keyFindings: [
      "P-Wellen und QRS unabhängig (AV-Dissoziation)",
      "ventrikulärer Ersatzrhythmus (oft breit, langsam)",
      "Frequenz meist 20–40/min (ventrikulär) oder 40–60/min (junktional)",
    ],
    interpretation: "Kompletter AV-Block (III°).",
    report:
      "AV-Dissoziation mit unabhängigen P-Wellen und QRS-Komplexen, langsamer Ersatzrhythmus. Bild eines AV-Blocks III°.",
    management: [
      "Symptomatisch? Atropin (häufig nur bei nodalem Block wirksam) / Katecholamine nach Standard",
      "Transkutanes Pacing vorbereiten, temporärer Schrittmacher",
      "Ursachen: Ischämie (inferior!), Medikamente, Degeneration",
    ],
    redFlags: ["Synkope/Hypotonie → pacing priorisieren", "Inferiorer MI als Ursache abklären"],
    examQuestions: ["Wie unterscheidest du AV-Block II vs III?", "Akuttherapie bei instabiler Bradykardie?"],
  },
  {
    id: "rbbb",
    title: "Rechts­schenkelblock (RSB)",
    category: "Block",
    tags: ["QRS >120 ms", "rSR' V1", "breite S in I/V6"],
    prompt: "Zufallsbefund oder Dyspnoe. EKG zeigt typische RSB-Morphologie.",
    keyFindings: [
      "QRS ≥ 120 ms",
      "rSR' in V1 (M-Form)",
      "breite S in I und V6",
      "sekundäre ST/T-Veränderungen möglich",
    ],
    interpretation: "Kompletter Rechtsschenkelblock.",
    report:
      "Verbreiterter QRS (≥120 ms) mit rSR' in V1 und breiter S in I/V6. Befund passend zu komplettem Rechtsschenkelblock.",
    management: ["Klinische Einordnung (neu? Symptome?)", "Bei Dyspnoe/Brustschmerz: Lungenembolie/ACS mitdenken"],
    redFlags: ["Neu aufgetretener RSB + Thoraxschmerz kann ACS sein", "RSB bei PE-Konstellation möglich"],
    examQuestions: ["Wie sieht ein RSB aus?", "Was bedeutet ein neu aufgetretener Schenkelblock klinisch?"],
  },
  {
    id: "lbbb",
    title: "Links­schenkelblock (LSB)",
    category: "Block",
    tags: ["QRS >120 ms", "breite R in I/V6", "Diskordanz"],
    prompt: "Dyspnoe/Brustschmerz. EKG: breiter QRS, LSB-Morphologie.",
    keyFindings: [
      "QRS ≥ 120 ms",
      "breite/notched R in I, aVL, V5–V6",
      "tiefe S in V1–V3",
      "sekundäre ST/T-Diskordanz",
    ],
    interpretation: "Kompletter Linksschenkelblock; Ischämiebeurteilung erschwert.",
    report:
      "Verbreiterter QRS (≥120 ms) mit LSB-Morphologie (breite R in lateralen Ableitungen, tiefe S in V1–V3) und sekundären Repolarisationsveränderungen. Befund eines kompletten Linksschenkelblocks.",
    management: ["Neu + Symptome → ACS/Ischämie ernst nehmen (Klinik!)", "Echo/Abklärung strukturelle Herzerkrankung"],
    redFlags: ["Ischämiediagnostik schwierig; klinische Instabilität zählt", "Sgarbossa-Kriterien als Konzept kennen"],
    examQuestions: ["Warum ist Ischämie bei LSB schwer zu beurteilen?", "Was sind Sgarbossa-Kriterien (Prinzip)?"],
  },
  {
    id: "hyperk",
    title: "Hyperkaliämie (spitze T-Wellen)",
    category: "Elektrolyt",
    tags: ["spitze T", "QRS-Verbreiterung", "Gefahr"],
    prompt: "Niereninsuffizienz. EKG: auffällig hohe, spitze T-Wellen.",
    keyFindings: [
      "spitze, zeltförmige T-Wellen",
      "PQ-Verlängerung möglich",
      "QRS-Verbreiterung bei schwerer Hyperkaliämie",
      "Übergang in Sinuswelle möglich",
    ],
    interpretation: "EKG-Zeichen einer Hyperkaliämie (potenziell lebensbedrohlich).",
    report:
      "Auffällig spitze T-Wellen, ggf. beginnende Leitungsverzögerung. Befund vereinbar mit Hyperkaliämie; klinisch/labordiagnostisch dringend abzuklären.",
    management: [
      "Sofortmaßnahmen nach Standard: Calcium i.v. (Membranstabilisierung) bei EKG-Veränderungen",
      "Shift: Insulin/Glukose, ggf. Beta2, Bicarbonat je nach Situation",
      "Elimination: Diuretika, Resine, Dialyse je nach Schwere",
    ],
    redFlags: ["EKG-Veränderungen = Notfall", "QRS breit / Sinuswelle → unmittelbar handeln"],
    examQuestions: ["Welche Akuttherapie gibst du bei EKG-Veränderungen?", "Welche EKG-Zeichen bei Hyperkaliämie?"],
  },
  {
    id: "hypok",
    title: "Hypokaliämie (U-Wellen)",
    category: "Elektrolyt",
    tags: ["U-Wellen", "QT verlängert", "Arrhythmie"],
    prompt: "Diuretika, Muskelschwäche. EKG: U-Wellen und QT-Verlängerung.",
    keyFindings: ["U-Wellen (v.a. präkordial)", "ST-Senkung/T-Abflachung", "scheinbar verlängertes QT (eigentlich QU)"],
    interpretation: "EKG-Zeichen einer Hypokaliämie.",
    report:
      "T-Abflachung/ST-Senkung mit prominenten U-Wellen, insgesamt verlängerte Repolarisation (QU). Bild passend zu Hypokaliämie.",
    management: ["Kalium substituieren (oral/i.v. je nach Schwere)", "Mg mitprüfen/substituieren", "Trigger/Medikamente anpassen"],
    redFlags: ["Torsade-Risiko bei Repolarisationsverlängerung", "Digitalis + Hypokaliämie gefährlich"],
    examQuestions: ["Was sind U-Wellen? Warum ist Hypokaliämie arrhythmogen?"],
  },
  {
    id: "pericarditis",
    title: "Akute Perikarditis",
    category: "Spezial",
    tags: ["diffuse ST-Hebung", "PR-Senkung", "Brustschmerz"],
    prompt: "Stechender Brustschmerz, besser im Sitzen. EKG: diffuse ST-Hebungen.",
    keyFindings: [
      "diffuse ST-Hebungen (konkav)",
      "PR-Senkungen (v.a. in inferior/lateral)",
      "keine reziproken ST-Senkungen wie beim STEMI (Ausnahmen möglich)",
    ],
    interpretation: "Akute Perikarditis (klinisch korrelieren).",
    report:
      "Diffuse, konkave ST-Hebungen mit PR-Senkungen, vereinbar mit akuter Perikarditis (klinische Korrelation).",
    management: ["NSAID + Colchicin nach Standard", "Ursachen klären", "Warnzeichen: Tamponade/ Myoperikarditis"],
    redFlags: ["Fieber, Immunsuppression, Tamponadezeichen", "Troponin hoch + Rhythmusprobleme → Myoperikarditis"],
    examQuestions: ["Wie unterscheidest du Perikarditis vs STEMI?", "Welche Therapie ist Standard?"],
  },
  {
    id: "wpw",
    title: "WPW (Delta-Welle)",
    category: "Spezial",
    tags: ["Delta", "kurzes PR", "breiter QRS"],
    prompt: "Anfallsweises Herzrasen, jung. EKG zwischen Attacken auffällig.",
    keyFindings: ["kurzes PR-Intervall", "Delta-Welle (slurred upstroke)", "QRS verbreitert"],
    interpretation: "Präexzitation (WPW-Muster).",
    report:
      "Kurzes PR-Intervall mit Delta-Welle und verbreitertem QRS. Befund eines Präexzitationssyndroms (WPW-Muster).",
    management: [
      "Bei Tachyarrhythmie: abhängig vom Rhythmus (bei Vorhofflimmern mit WPW keine AV-Blocker!)",
      "Langfristig: elektrophysiologische Abklärung / Ablation",
    ],
    redFlags: ["AF + WPW → lebensgefährliche Überleitung möglich", "AV-Blocker kontraindiziert bei preexzitiertem AF"],
    examQuestions: ["Warum sind AV-Blocker bei AF+WPW gefährlich?", "Was ist die Delta-Welle?"],
  },
  {
    id: "lvh_strain",
    title: "LVH mit Strain",
    category: "Hypertrophie",
    tags: ["Sokolow-Lyon", "ST/T strain", "Hypertonie"],
    prompt: "Langjähriger Hypertonus. EKG: hohe Spannungen + Repolarisationsstörung.",
    keyFindings: [
      "hohe QRS-Amplituden (z.B. Sokolow-Lyon-Kriterium als Konzept)",
      "ST-Senkung/T-Negativierung lateral (Strain)",
      "linkstypische Achse möglich",
    ],
    interpretation: "Linksventrikuläre Hypertrophie mit Strain-Muster.",
    report:
      "Hohe QRS-Spannungen mit sekundären Repolarisationsveränderungen (ST-Senkung/T-Negativierung lateral) – Bild einer linksventrikulären Hypertrophie mit Strain.",
    management: ["Hypertonie/Afterload adressieren", "Echo zur Hypertrophie/Strukturerkrankung"],
    redFlags: ["Strain vs Ischämie abgrenzen (Klinik, Verlauf, Troponin)", "HCM-DD bedenken bei passender Klinik"],
    examQuestions: ["Welche Kriterien für LVH kennst du?", "Wie unterscheidest du Strain vs Ischämie?"],
  },
  {
    id: "torsade_hint",
    title: "QT-Verlängerung (Torsade-Risiko)",
    category: "Spezial",
    tags: ["QT lang", "Medikamente", "Synkope"],
    prompt: "Synkope, neue Medikation (z.B. QT-verlängernd). EKG: QT deutlich verlängert.",
    keyFindings: ["QTc verlängert", "T-U-Morphologie auffällig", "Prädisposition für Torsade de pointes"],
    interpretation: "QT-Verlängerung → arrhythmogenes Risiko.",
    report:
      "Deutlich verlängerte QT-Zeit (QTc). Befund mit erhöhtem Risiko für Torsade-de-pointes-Arrhythmien; Ursache/Medikation prüfen.",
    management: ["Ursache/Medikamente stoppen", "Elektrolyte korrigieren (K, Mg)", "Bei Torsade: Mg i.v., ggf. Overdrive/Schock je nach Situation"],
    redFlags: ["Torsade kann degenerieren → Notfall", "Bradykardie verstärkt Risiko"],
    examQuestions: ["Wie misst du QTc grob?", "Was ist Akuttherapie bei Torsade?"],
  },
];

export function getEkgCaseById(id: string): EkgCase | null {
  return EKG_CASES.find((c) => c.id === id) ?? null;
}

export function pickRandomEkgCase(category?: EkgCategory | null): EkgCase {
  const pool = category ? EKG_CASES.filter((c) => c.category === category) : EKG_CASES;
  const list = pool.length ? pool : EKG_CASES;
  return list[Math.floor(Math.random() * list.length)];
}

export const EKG_ANALYSIS_PATH: { title: string; points: string[] }[] = [
  {
    title: "1) Rhythmus & Frequenz",
    points: ["regelmäßig vs unregelmäßig", "P vor jedem QRS?", "HF grob abschätzen"],
  },
  {
    title: "2) Lagetyp",
    points: ["I und aVF (grob)", "Extremachsen bei Tachykardien mitdenken"],
  },
  {
    title: "3) Intervalle",
    points: ["PR", "QRS-Breite", "QT/QTc (Risikofaktor!)"],
  },
  {
    title: "4) Morphologie",
    points: ["P-Wellen", "QRS (Block/Präexzitation?)", "ST/T (Ischämie, Perikarditis, Elektrolyt)"],
  },
  {
    title: "5) Zusammenfassen",
    points: ["1 Satz Befund + 1 Satz Interpretation", "nächster Schritt/Management nennen"],
  },
];
