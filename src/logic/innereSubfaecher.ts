// src/logic/innereSubfaecher.ts
import type { SelectItem } from "./fachrichtungen";

export const INNERE_SUBFAECHER: SelectItem[] = [
  { label: "Alle (kein Unterfach)", value: "all" },

  { label: "Kardiologie", value: "Kardiologie" },
  { label: "Pneumologie", value: "Pneumologie" },
  { label: "Gastroenterologie", value: "Gastroenterologie" },
  { label: "Nephrologie", value: "Nephrologie" },
  { label: "Endokrinologie/Diabetologie", value: "Endokrinologie/Diabetologie" },
  { label: "Hämatologie/Onkologie", value: "Hämatologie/Onkologie" },
  { label: "Infektiologie", value: "Infektiologie" },
  { label: "Rheumatologie", value: "Rheumatologie" },
];
