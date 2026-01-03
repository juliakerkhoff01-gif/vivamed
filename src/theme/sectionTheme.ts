export type AppSection =
  | "home"
  | "simulation"
  | "plan"
  | "trainer"
  | "progress"
  | "settings";

export type SectionTokens = {
  /** Akzentfarbe (Buttons/Chips/Progressfills) */
  tint: string;

  /** Pastell-Hintergrund der Section */
  bg: string;

  /** “Wash” oben (kann rgba sein) */
  bg2: string;

  /** Standard Border (leicht getönt) */
  border: string;
};

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Base Background: neutral + sehr leicht (damit es “clean” bleibt)
 * Der Pastell-Look kommt primär über bg2 (wash) + tint + border.
 */
const BASE_BG = "#F7FAFC";

function makeTokens(tint: string): SectionTokens {
  return {
    tint,
    bg: BASE_BG,
    bg2: rgba(tint, 0.10),      // Pastell-Wash oben
    border: rgba(tint, 0.14),   // leicht getönte Border
  };
}

export const SECTION_THEMES: Record<AppSection, SectionTokens> = {
  home: makeTokens("#0F766E"),       // teal (Brand)
  simulation: makeTokens("#2563EB"), // blue
  plan: makeTokens("#F59E0B"),       // amber
  trainer: makeTokens("#7C3AED"),    // violet
  progress: makeTokens("#16A34A"),   // green
  settings: makeTokens("#0EA5E9"),   // sky
};
