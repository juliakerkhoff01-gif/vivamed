export type RoentgenCategory =
  | "Thorax"
  | "Pneu/Pleura"
  | "Stauung/Herz"
  | "Pneumonie"
  | "Trauma"
  | "Skelett";

export type RoentgenCase = {
  id: string;
  title: string;
  category: RoentgenCategory;
  tags: string[];

  /** Kurz-Szenario (1–2 Sätze) */
  prompt: string;

  /** Was soll man im Bild finden/prüfen (Checkliste) */
  keyFindings: string[];

  /** Prüfungsreife Befund-Formulierung */
  report: string;

  /** wichtigste DDx/Abgrenzungen (kurz) */
  differential: string[];

  /** nächste Schritte / Management */
  nextSteps: string[];

  /** typische Fallen */
  pitfalls: string[];

  /** typische Prüfungsfragen */
  examQuestions: string[];
};

export const ROENTGEN_CATEGORIES: { id: RoentgenCategory; label: string }[] = [
  { id: "Thorax", label: "Thorax" },
  { id: "Pneu/Pleura", label: "Pneu/Pleura" },
  { id: "Stauung/Herz", label: "Stauung/Herz" },
  { id: "Pneumonie", label: "Pneumonie" },
  { id: "Trauma", label: "Trauma" },
  { id: "Skelett", label: "Skelett" },
];

export const ROENTGEN_QUALITY_PATH: { title: string; points: string[] }[] = [
  {
    title: "0) Bildqualität (RIPE)",
    points: [
      "R = Rotation? (Sternoklavikulargelenke symmetrisch?)",
      "I = Inspiration ausreichend? (ca. 6 vordere Rippen über Zwerchfell)",
      "P = Projektion: PA vs AP (Herz wirkt in AP größer)",
      "E = Exposure/Penetration: Wirbelsäule hinter Herz gerade erkennbar?",
    ],
  },
];

export const ROENTGEN_THORAX_PATH: { title: string; points: string[] }[] = [
  {
    title: "1) A – Airway",
    points: ["Trachea mittig?", "Carina/ Hauptbronchien", "Mediastinum verbreitert?"],
  },
  {
    title: "2) B – Breathing (Lungen/Pleura)",
    points: ["Transparenz beidseits", "Infiltrate/Konsolidierungen", "Pneumothorax? Pleuraerguss?"],
  },
  {
    title: "3) C – Circulation (Herz/Hilum/Gefäße)",
    points: ["Herzgröße (CTR grob)", "Hilus/Vaskularisation", "Stauungszeichen?"],
  },
  {
    title: "4) D – Diaphragm",
    points: ["Zwerchfellkuppeln", "Kostophrenische Winkel frei?", "freie Luft?"],
  },
  {
    title: "5) E – Everything else",
    points: ["Knochen/Weichteile", "Schläuche/Lines", "alte Befunde/Vergleich"],
  },
];

export const ROENTGEN_SKELETON_PATH: { title: string; points: string[] }[] = [
  {
    title: "Skelett-Schema (kurz & sicher)",
    points: [
      "1) Alignment: Achse/ Stellung/ Gelenkspalt",
      "2) Bone: Kortikalis durchgängig? Frakturlinien?",
      "3) Cartilage/Joint: Gelenkspalt, Luxation/Subluxation?",
      "4) Soft tissue: Schwellung, Hämatom, Luft, Fremdkörper",
    ],
  },
];

export const ROENTGEN_CASES: RoentgenCase[] = [
  {
    id: "pneumothorax_right",
    title: "Pneumothorax rechts",
    category: "Pneu/Pleura",
    tags: ["Pleuralinie", "keine Gefäßzeichnung", "Notfall"],
    prompt: "Akute Dyspnoe/Thoraxschmerz. Röntgen Thorax: rechts auffällig transparent.",
    keyFindings: [
      "sichtbare viszerale Pleuralinie",
      "peripher keine Gefäßzeichnungen",
      "ggf. Mediastinalverlagerung bei Spannungspneu",
    ],
    report:
      "Rechtsseitiger Pneumothorax mit sichtbarer Pleuralinie und fehlender peripherer Gefäßzeichnung. Spannungskomponenten klinisch abklären (Mediastinalverlagerung?).",
    differential: ["Hautfalte (Skin fold)", "Bullae/Emphysem", "Fehlprojektion/Rotation"],
    nextSteps: [
      "Klinik: instabil? → Entlastung/Drainage nach Standard",
      "bei stabil: Größe abschätzen, Verlauf/Drainage je nach Setting",
      "Ursache: Trauma? spontan? iatrogen?",
    ],
    pitfalls: ["Skin fold kann Pneu imitieren", "Spannungspneu ist klinische Diagnose – nicht auf Bild warten"],
    examQuestions: ["Welche Zeichen sprechen für Spannungspneu?", "Was sind DDx zur Pleuralinie?"],
  },
  {
    id: "pleural_effusion_left",
    title: "Pleuraerguss links",
    category: "Pneu/Pleura",
    tags: ["Meniskus", "Winkel verstrichen", "Basal"],
    prompt: "Dyspnoe, ggf. Herzinsuffizienz/Infekt. Röntgen: basal links Verschattung.",
    keyFindings: [
      "verstrichener kostophrenischer Winkel",
      "basale homogene Verschattung",
      "Meniskuszeichen möglich",
    ],
    report:
      "Basal links homogene Verschattung mit verstrichenem kostophrenischem Winkel, vereinbar mit Pleuraerguss links (Größe klinisch/sonografisch korrelieren).",
    differential: ["Basales Infiltrat", "Atelektase", "Zwerchfellhochstand"],
    nextSteps: ["Sono zur Bestätigung/Quantifizierung", "Ursachen: Stauung, Infekt, Malignom, PE", "Punktion bei Indikation"],
    pitfalls: ["AP/liegend kann Erguss anders aussehen", "Atelektase vs Erguss: Volumenzeichen beachten"],
    examQuestions: ["Wie erkennt man einen kleinen Erguss?", "Wann punktierst du?"],
  },
  {
    id: "pulmonary_edema",
    title: "Kardiales Lungenödem (Stauung)",
    category: "Stauung/Herz",
    tags: ["Kerley-B", "perihilär", "Stauung"],
    prompt: "Akute Dyspnoe, Orthopnoe. Röntgen: beidseits perihiläre Verschattungen.",
    keyFindings: [
      "Gefäßumverteilung (Cephalisation)",
      "interstitielles Ödem: Kerley-B-Linien",
      "alveoläres Ödem: perihiläre ‘bat-wing’ Verschattung",
      "Pleuraergüsse häufig",
    ],
    report:
      "Zeichen der pulmonalvenösen Stauung mit interstitiellen/alveolären Ödemzeichen (z.B. Kerley-B, perihiläre Verschattungen), ggf. begleitende Pleuraergüsse. Vereinbar mit kardialem Lungenödem.",
    differential: ["ARDS", "Pneumonie (meist fokaler)", "alveoläre Blutung"],
    nextSteps: ["klinisch behandeln nach Standard (O2/NIV/Diuretika etc.)", "Echo/Herzursache klären", "Verlaufskontrolle"],
    pitfalls: ["AP-Projektion vergrößert Herz", "Pneumonie vs Ödem: Verteilung/Verlauf beachten"],
    examQuestions: ["Was sind Kerley-B-Linien?", "Wie unterscheidest du Ödem vs Pneumonie?"],
  },
  {
    id: "cardiomegaly",
    title: "Kardiomegalie",
    category: "Stauung/Herz",
    tags: ["CTR", "PA vs AP", "Herzgröße"],
    prompt: "Langjährige Dyspnoe/Herzinsuffizienz. Röntgen: Herz wirkt groß.",
    keyFindings: [
      "Herzgröße beurteilen nur sinnvoll in PA",
      "CTR > ~0,5 als grobes Kriterium (PA, guter Inspiration)",
      "begleitende Stauungszeichen? Ergüsse?",
    ],
    report:
      "Vergrößerte Herzsilhouette (Herzgröße abhängig von Projektion/Inspirationslage; in PA-Konstellation vereinbar mit Kardiomegalie). Begleitzeichen der Stauung prüfen.",
    differential: ["AP-Projektion (Pseudo-Kardiomegalie)", "Perikarderguss", "Technik (Rotation/Inspiration)"],
    nextSteps: ["Klinik/BNP/Echo zur Abklärung", "Verlauf/alte Bilder vergleichen"],
    pitfalls: ["In AP (z.B. Bettaufnahme) wirkt Herz größer", "schlechte Inspiration macht Herz scheinbar größer"],
    examQuestions: ["Wann ist CTR sinnvoll?", "Wie unterscheidest du Perikarderguss vs Kardiomegalie?"],
  },
  {
    id: "pneumonia_rll",
    title: "Pneumonie rechter Unterlappen",
    category: "Pneumonie",
    tags: ["Konsolidierung", "Bronchopneumogramm", "Fieber"],
    prompt: "Fieber, Husten, Dyspnoe. Röntgen: fokales Infiltrat basal rechts.",
    keyFindings: [
      "fokale Konsolidierung im rechten Unterfeld",
      "Bronchopneumogramm möglich",
      "Silhouettenzeichen je nach Lokalisation",
    ],
    report:
      "Fokale Konsolidierung im rechten Unterlappen mit Infiltratzeichen, vereinbar mit Pneumonie (klinisch korrelieren).",
    differential: ["Atelektase", "Lungenembolie mit Infarkt", "Tumor (bei Persistenz)"],
    nextSteps: ["Therapie nach Standard, Verlauf", "Kontroll-Röntgen bei Risikoprofil/Persistenz", "CRP/Prokalzitonin je nach Setting"],
    pitfalls: ["Atelektase zeigt Volumenverlust (Zwerchfellhochstand, Mediastinumzug)", "Frühe Pneumonie kann im Röntgen noch fehlen"],
    examQuestions: ["Was ist das Silhouettenzeichen?", "Wann machst du ein Kontroll-Röntgen?"],
  },
  {
    id: "atelectasis_l",
    title: "Atelektase (Volumenverlust)",
    category: "Thorax",
    tags: ["Volumenverlust", "Zugzeichen", "Zwerchfellhochstand"],
    prompt: "Postoperativ, flache Atmung. Röntgen: Verschattung mit Zugzeichen.",
    keyFindings: [
      "Verschattung + Volumenverlust",
      "Mediastinalzug zur betroffenen Seite möglich",
      "Zwerchfellhochstand, Rippen enger",
    ],
    report:
      "Verschattung mit Volumenverlustzeichen (z.B. Mediastinalzug, Zwerchfellhochstand) – vereinbar mit Atelektase. Lokalisation je nach betroffenen Segmenten/Lappen.",
    differential: ["Pneumonie (meist kein Volumenverlust)", "Pleuraerguss (drückt eher weg)"],
    nextSteps: ["Atemtherapie/Mobilisation", "Sekretmanagement", "Ursache klären (z.B. Schleimpfropf)"],
    pitfalls: ["Erguss vs Atelektase über Volumenzeichen trennen", "Rotation kann Mediastinum scheinbar verschieben"],
    examQuestions: ["Welche Volumenzeichen kennst du?", "Wie unterscheidest du Atelektase vs Erguss?"],
  },
  {
    id: "rib_fracture",
    title: "Rippenfraktur",
    category: "Trauma",
    tags: ["Trauma", "Pleura", "Pneu ausschließen"],
    prompt: "Sturz/Prelltrauma. Röntgen: lokaler Schmerz. Frage: Fraktur? Pneu?",
    keyFindings: [
      "Frakturlinie/Stufenbildung an Rippe (oft schwer sichtbar)",
      "Begleitkomplikation suchen: Pneumothorax, Hämatothorax",
    ],
    report:
      "Hinweis auf Rippenfraktur (falls sichtbar). Wichtig: Begleitkomplikationen wie Pneumothorax oder Pleuraerguss/Hämatothorax mitbeurteilen.",
    differential: ["Kontusion ohne Fraktur", "Projektionsartefakte"],
    nextSteps: ["Klinik/Schmerztherapie", "bei Komplikationsverdacht: Sono/CT je nach Setting", "Atemtraining (Pneumonieprophylaxe)"],
    pitfalls: ["Rippenfrakturen werden im Röntgen oft übersehen", "Gefahr ist Komplikation, nicht nur Fraktur"],
    examQuestions: ["Was ist die wichtigste Komplikation der Rippenfraktur im Thoraxbild?", "Wann CT?"],
  },
  {
    id: "clavicle_fracture",
    title: "Claviculafraktur",
    category: "Skelett",
    tags: ["Schulter", "Dislokation", "Neurovaskulär"],
    prompt: "Sturz auf Schulter. Röntgen: Schmerz, Deformität.",
    keyFindings: ["Frakturlinie der Clavicula", "Dislokation/Verkürzung", "AC/SC-Gelenk mitbeurteilen"],
    report:
      "Fraktur der Clavicula (Lokalisation/Dislokation je nach Bild). Gelenkbeteiligung und Achsstellung beurteilen.",
    differential: ["AC-Gelenksprengung", "SC-Verletzung (schwerer zu sehen)"],
    nextSteps: ["Neurovaskulär prüfen", "konservativ häufig, OP bei starker Dislokation/Mehrfragment", "Orthopädie/Trauma nach Standard"],
    pitfalls: ["SC-Verletzung kann im Standardbild übersehen werden", "immer neurovaskulären Status dokumentieren"],
    examQuestions: ["Welche Kriterien sprechen eher für OP?", "Was musst du klinisch unbedingt prüfen?"],
  },
  {
    id: "hip_neck_fracture",
    title: "Schenkelhalsfraktur (Hinweisbefund)",
    category: "Skelett",
    tags: ["Hüfte", "Garden", "Trauma älter"],
    prompt: "Sturz im Alter, Hüftschmerz, Außenrotationsfehlstellung.",
    keyFindings: [
      "Frakturlinie am Schenkelhals ggf. subtil",
      "Unterbrechung der Shenton-Linie möglich",
      "Außenrotation kann Beurteilung erschweren",
    ],
    report:
      "Verdacht auf Schenkelhalsfraktur (ggf. diskret). Bei klinischem Verdacht trotz unauffälligem Röntgen: weitere Bildgebung (CT/MRT) erwägen.",
    differential: ["Prellung", "Pertrochantäre Fraktur", "Insuffizienzfraktur"],
    nextSteps: ["Schmerztherapie/Immobilisation", "CT/MRT bei unklar", "operative Versorgung nach Standard"],
    pitfalls: ["Nicht jede Fraktur ist im Röntgen sicher sichtbar", "Außenrotation kann Frakturen ‘verstecken’"],
    examQuestions: ["Was machst du bei hohem Verdacht und unauffälligem Röntgen?", "Was ist die Shenton-Linie?"],
  },
  {
    id: "shoulder_dislocation",
    title: "Schulterluxation anterior",
    category: "Skelett",
    tags: ["Luxation", "Y-View", "Neurovaskulär"],
    prompt: "Sturz/Trauma. Arm in Schonhaltung. Röntgen: Luxation?",
    keyFindings: [
      "Humeruskopf nicht zentriert in Glenoid",
      "anterior-inferior häufig",
      "Begleitfraktur (Hill-Sachs/Bankart) mitdenken",
    ],
    report:
      "Befund einer anterioren Schulterluxation (je nach Projektion). Begleitfrakturen und Glenoidrand prüfen; nach Reposition Kontrollbild.",
    differential: ["Posteriorluxation (Achtung: ‘lightbulb sign’)", "AC-Gelenksverletzung"],
    nextSteps: ["Neurovaskulär vor/nach Reposition", "Reposition nach Standard", "Kontrollbild, Immobilisation, Ortho-FU"],
    pitfalls: ["Posteriorluxation wird leicht übersehen", "keine Reposition ohne neurovaskulären Status"],
    examQuestions: ["Welche Zeichen sprechen für Posteriorluxation?", "Was dokumentierst du vor Reposition?"],
  },
  {
    id: "foreign_lines_check",
    title: "Schläuche & Lines Check",
    category: "Thorax",
    tags: ["Tubus", "ZVK", "Magensonde", "Lagekontrolle"],
    prompt: "Intensivpatient. Röntgen zur Lagekontrolle.",
    keyFindings: [
      "Tubusspitze ideal ca. 3–5 cm über Carina",
      "ZVK-Spitze in V. cava superior (je nach Standard)",
      "Magensonde unter Zwerchfell, Spitze im Magen",
      "Komplikationen: Pneumothorax nach ZVK",
    ],
    report:
      "Lagekontrolle: Tubus-/ZVK-/Magensondenlage gemäß Standard beurteilen; zusätzlich Komplikationen (z.B. Pneumothorax) ausschließen.",
    differential: ["Fehlprojektion/Rotation kann Lage täuschen"],
    nextSteps: ["bei Fehlposition korrigieren", "bei Komplikation behandeln (z.B. Pneu)", "bei Unsicherheit: weitere Bildgebung"],
    pitfalls: ["Magensonde kann in Bronchus liegen → lebensgefährlich", "ZVK kann Pneu verursachen"],
    examQuestions: ["Wo muss die Tubusspitze liegen?", "Welche Komplikation nach ZVK musst du im Bild ausschließen?"],
  },
  {
    id: "mediastinum_wide",
    title: "Mediastinum verbreitert (Red Flag)",
    category: "Thorax",
    tags: ["Aorta", "Trauma", "AP-Projektion"],
    prompt: "Thoraxschmerz/Trauma. Bild zeigt scheinbar verbreitertes Mediastinum.",
    keyFindings: [
      "Mediastinum breit (aber Projektion/Rotation beachten)",
      "Aortenknopf auffällig?",
      "Begleitzeichen: Pleuraerguss, apikale Kappe (Trauma-Kontext)",
    ],
    report:
      "Scheinbar verbreitertes Mediastinum. Befund ist stark abhängig von Projektion (AP) und Rotation; bei passender Klinik/Trauma: dringende weitere Abklärung (CT-Angiographie) erwägen.",
    differential: ["AP-Projektion", "Rotation", "Aortenpathologie (Dissektion)", "Mediastinalblutung (Trauma)"],
    nextSteps: ["RIPE prüfen", "bei klinischem Verdacht: CT-Angio", "Vitals/Schmerz/Neurologie beurteilen"],
    pitfalls: ["AP macht Mediastinum scheinbar breit", "Red Flag nie wegdiskutieren, wenn Klinik passt"],
    examQuestions: ["Warum ist Mediastinum-Breite im AP-Bettbild schwierig?", "Wann CT-Angio?"],
  },
];

export function getRoentgenCaseById(id: string): RoentgenCase | null {
  return ROENTGEN_CASES.find((c) => c.id === id) ?? null;
}

export function pickRandomRoentgenCase(category?: RoentgenCategory | null): RoentgenCase {
  const pool = category ? ROENTGEN_CASES.filter((c) => c.category === category) : ROENTGEN_CASES;
  const list = pool.length ? pool : ROENTGEN_CASES;
  return list[Math.floor(Math.random() * list.length)];
}
