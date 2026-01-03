// src/logic/fachrichtungen.ts

export type SelectItem = { label: string; value: string };

/**
 * Master-Liste (V1): langfristige Auswahl-Liste für die App.
 * Diese Liste darf groß sein (auch Fächer ohne Cases).
 */
export const FACHRICHTUNGEN: SelectItem[] = [
  { label: "Allgemeinmedizin", value: "Allgemeinmedizin" },
  { label: "Innere Medizin", value: "Innere Medizin" },

  { label: "Chirurgie", value: "Chirurgie" },
  { label: "Orthopädie & Unfallchirurgie", value: "Orthopädie & Unfallchirurgie" },

  { label: "Anästhesiologie", value: "Anästhesiologie" },
  { label: "Intensivmedizin", value: "Intensivmedizin" },
  { label: "Notfallmedizin", value: "Notfallmedizin" },

  // Innere-nahe „Schwerpunkte“ (als eigene Auswahl in der Master-Liste)
  { label: "Kardiologie", value: "Kardiologie" },
  { label: "Pneumologie", value: "Pneumologie" },
  { label: "Gastroenterologie", value: "Gastroenterologie" },
  { label: "Nephrologie", value: "Nephrologie" },
  { label: "Endokrinologie/Diabetologie", value: "Endokrinologie/Diabetologie" },
  { label: "Hämatologie/Onkologie", value: "Hämatologie/Onkologie" },
  { label: "Infektiologie", value: "Infektiologie" },
  { label: "Rheumatologie", value: "Rheumatologie" },

  { label: "Neurologie", value: "Neurologie" },
  { label: "Psychiatrie", value: "Psychiatrie" },

  { label: "Pädiatrie", value: "Pädiatrie" },
  { label: "Gynäkologie & Geburtshilfe", value: "Gynäkologie & Geburtshilfe" },

  { label: "Dermatologie", value: "Dermatologie" },
  { label: "HNO", value: "HNO" },
  { label: "Augenheilkunde", value: "Augenheilkunde" },
  { label: "Urologie", value: "Urologie" },

  { label: "Radiologie", value: "Radiologie" },
  { label: "Nuklearmedizin", value: "Nuklearmedizin" },
  { label: "Pathologie", value: "Pathologie" },
  { label: "Mikrobiologie/Virologie", value: "Mikrobiologie/Virologie" },

  { label: "Arbeitsmedizin", value: "Arbeitsmedizin" },
  { label: "Rechtsmedizin", value: "Rechtsmedizin" },
];

export const FACHRICHTUNGEN_WITH_EMPTY: SelectItem[] = [{ label: "—", value: "" }, ...FACHRICHTUNGEN];

/**
 * APP-Liste (Prio für UI): nur das, was du aktuell in der App wirklich anbietest,
 * damit Nutzer nicht 20 Fächer auswählen können, für die es noch keine Cases gibt.
 *
 * Wichtig: Diese Werte müssen zu deinen bestehenden Strings in Screens/Cases passen.
 */
export const APP_FACHRICHTUNGEN: SelectItem[] = [
  { label: "Innere Medizin", value: "Innere Medizin" },
  { label: "Chirurgie", value: "Chirurgie" },
  { label: "Pädiatrie", value: "Pädiatrie" },

  // Diese Werte hattest du im HomeScreen bereits so verwendet:
  { label: "Gynäkologie", value: "Gynäkologie" },
  { label: "Neurologie", value: "Neurologie" },
  { label: "Anästhesie/Intensiv", value: "Anästhesie/Intensiv" },
];

/**
 * Unterfächer Innere Medizin (für innereSubfach).
 * Werte müssen exakt zu cases.ts (CaseTemplate.subfach) passen.
 */
export const INNERE_SUBFAECHER: SelectItem[] = [
  { label: "Alle inneren Fächer", value: "all" },
  { label: "Kardiologie", value: "Kardiologie" },
  { label: "Pneumologie", value: "Pneumologie" },
  { label: "Gastroenterologie", value: "Gastroenterologie" },
  { label: "Nephrologie", value: "Nephrologie" },
  { label: "Endokrinologie/Diabetologie", value: "Endokrinologie/Diabetologie" },
  { label: "Infektiologie", value: "Infektiologie" },
  { label: "Hämatologie/Onkologie", value: "Hämatologie/Onkologie" },
  { label: "Rheumatologie", value: "Rheumatologie" },
  { label: "Geriatrie", value: "Geriatrie" },
];
