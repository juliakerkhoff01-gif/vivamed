// src/logic/investigations.ts

export type InvestigationCategory = "LAB" | "BGA" | "EKG" | "ROENTGEN" | "CT" | "SONO";

export type InvestigationResult = {
  title: string;
  summary: string;
  details?: string[];
};

export type InvestigationItem = {
  id: string;
  category: InvestigationCategory;
  label: string;
  result: InvestigationResult;
};

export const INVESTIGATION_CATEGORIES: { key: InvestigationCategory; label: string }[] = [
  { key: "LAB", label: "Labor" },
  { key: "BGA", label: "BGA" },
  { key: "EKG", label: "EKG" },
  { key: "ROENTGEN", label: "Röntgen" },
  { key: "CT", label: "CT" },
  { key: "SONO", label: "Sono" },
];

export const INVESTIGATIONS: InvestigationItem[] = [
  {
    id: "lab_basic_normal",
    category: "LAB",
    label: "Labor (Basis)",
    result: {
      title: "Labor (Basis)",
      summary: "Hb 13.8 g/dl, Leuko 7.2/nl, CRP 4 mg/l, Na 139 mmol/l, K 4.1 mmol/l, Kreatinin 0.9 mg/dl.",
      details: ["Kein Hinweis auf ausgeprägte Entzündung oder Elektrolytstörung."],
    },
  },
  {
    id: "ekg_af",
    category: "EKG",
    label: "12-Kanal-EKG",
    result: {
      title: "12-Kanal-EKG",
      summary: "Absolute Arrhythmie, keine P-Wellen, schmale QRS-Komplexe – vereinbar mit Vorhofflimmern.",
      details: ["Keine ST-Hebungen.", "HF ~120/min."],
    },
  },
  {
    id: "roentgen_pneumonia",
    category: "ROENTGEN",
    label: "Röntgen Thorax",
    result: {
      title: "Röntgen Thorax",
      summary: "Infiltrat rechts basal, kein Pleuraerguss, keine Zeichen eines Pneumothorax.",
      details: ["Befund vereinbar mit Pneumonie (klinisch korrelieren)."],
    },
  },

  // --- NEU: mehr Untersuchungen ---
  {
    id: "bga_acidosis",
    category: "BGA",
    label: "BGA (arteriell)",
    result: {
      title: "BGA (arteriell)",
      summary: "pH 7.28, pCO2 30 mmHg, HCO3- 14 mmol/l, Lactat 4.2 mmol/l.",
      details: [
        "Metabolische Azidose mit erhöhtem Lactat – Hinweis auf Hypoperfusion/Sepsis/Schock (klinisch korrelieren).",
      ],
    },
  },
  {
    id: "lab_troponin_positive",
    category: "LAB",
    label: "Troponin",
    result: {
      title: "Troponin",
      summary: "hs-Troponin T 86 ng/l (↑), Verlaufskontrolle empfohlen.",
      details: ["Bei passender Klinik: ACS bis zum Beweis des Gegenteils."],
    },
  },
  {
    id: "ct_head_bleed",
    category: "CT",
    label: "CT Kopf (nativ)",
    result: {
      title: "CT Kopf (nativ)",
      summary: "Akute intrazerebrale Blutung frontoparietal rechts, keine Mittellinienverlagerung.",
      details: ["Neurochirurgische Mitbeurteilung dringend empfohlen."],
    },
  },
  {
    id: "sono_abd_appendicitis",
    category: "SONO",
    label: "Sono Abdomen",
    result: {
      title: "Sono Abdomen",
      summary: "Nicht komprimierbare Appendix, Wandverdickung, periappendikuläre Flüssigkeit.",
      details: ["Befund vereinbar mit Appendizitis."],
    },
  },
];

export type OrderedTest = {
  item: InvestigationItem;
  orderedAt: number;
};

export function orderTest(testId: string): OrderedTest {
  const item = INVESTIGATIONS.find((i) => i.id === testId);
  if (!item) throw new Error(`Unknown testId: ${testId}`);
  return { item, orderedAt: Date.now() };
}

export function formatResultForChat(ordered: OrderedTest): string {
  const { result } = ordered.item;
  const lines: string[] = [];
  lines.push(`${result.title} – Befund:`);
  lines.push(result.summary);

  if (result.details?.length) {
    lines.push("");
    for (const d of result.details) lines.push(`• ${d}`);
  }
  return lines.join("\n");
}
