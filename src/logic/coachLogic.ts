// src/logic/coachLogic.ts

// Wir halten es robust: wenig Annahmen über deine Typen/Struktur.
export type CoachFlag =
  | "premature_commitment"
  | "missing_redflags"
  | "overdiagnostics"
  | "no_prioritization"
  | "missing_first_steps"
  | "communication_blindspot";

export type CoachArgs = {
  // kompletter Chatverlauf, damit wir nichts doppelt fragen
  messages: Array<{ role?: string; content?: string; text?: string }>;
  phase: string; // "intro" | "ddx" | "diagnostics" | "management" | "closing"
  userText: string;
  // Optional: checklist der aktuellen Phase (für redflags fall-spezifischer)
  checklistItems?: Array<{ label?: string; keywords?: string[] }>;
};

const TAG = (flag: CoachFlag) => `⟦coach:${flag}⟧`;

function msgText(m: any) {
  return (m?.content ?? m?.text ?? "").toString();
}

/**
 * In VivaMed sind Prüfer-Nachrichten role="examiner".
 * Wir prüfen, ob wir dieselbe Coach-Frage schon einmal gestellt haben.
 */
function alreadyAsked(messages: CoachArgs["messages"], flag: CoachFlag) {
  return messages.some((m) => (m?.role ?? "") === "examiner" && msgText(m).includes(TAG(flag)));
}

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, arr: string[]) {
  const t = norm(text);
  return arr.some((k) => t.includes(norm(k)));
}

function detectFlag(args: CoachArgs): CoachFlag | null {
  const { phase, userText, checklistItems } = args;

  const p = norm(phase);
  const t = norm(userText);

  // 1) Red Flags fehlen (generic + optional checklist-basiert)
  const genericRedFlagWords = [
    "abcde",
    "vital",
    "vitalparameter",
    "blutdruck",
    "puls",
    "sättigung",
    "sao2",
    "atemfrequenz",
    "bewusstsein",
    "gcs",
    "schock",
    "sepsis",
    "thoraxschmerz",
    "dyspnoe",
    "synkope",
    "blutung",
  ];

  const checklistLooksLikeRedFlags =
    (checklistItems ?? []).filter((it) => {
      const l = norm(it?.label ?? "");
      return l.includes("red flag") || l.includes("notfall") || l.includes("ausschluss") || l.includes("gefährlich");
    }) ?? [];

  const mentionsSomeRedFlag =
    hasAny(t, genericRedFlagWords) ||
    checklistLooksLikeRedFlags.some((it) => hasAny(t, it.keywords ?? []) || hasAny(t, [it.label ?? ""]));

  if ((p === "ddx" || p === "diagnostics") && !mentionsSomeRedFlag) {
    return "missing_redflags";
  }

  // 2) Zu früh festgelegt (premature commitment)
  const commitmentPhrases = [
    "diagnose ist",
    "es ist",
    "wahrscheinlich",
    "sicher",
    "ich bin mir sicher",
    "definitiv",
    "das ist",
  ];
  const ddxPhrases = ["ddx", "differential", "könnte auch", "alternativ", "top 3", "differenzialdiagnose"];
  if (p === "intro" || p === "ddx") {
    if (hasAny(t, commitmentPhrases) && !hasAny(t, ddxPhrases)) return "premature_commitment";
  }

  // 3) Overdiagnostics (CT/MRT/Angio zu früh)
  const advanced = ["ct", "cct", "mrt", "angio", "cta", "mra", "pet", "szinti", "herzkatheter"];
  const basics = ["anamnese", "körperlich", "untersuchung", "vital", "ekg", "labor", "sono", "ultraschall", "bga"];
  if ((p === "diagnostics" || p === "ddx") && hasAny(t, advanced) && !hasAny(t, basics)) {
    return "overdiagnostics";
  }

  // 4) Keine Priorisierung (nur Liste ohne Reihenfolge)
  const ordering = ["zuerst", "erstens", "prior", "als erstes", "initial", "schritt 1", "akut", "sofort"];
  if ((p === "diagnostics" || p === "management") && !hasAny(t, ordering) && t.split(" ").length > 30) {
    return "no_prioritization";
  }

  // 5) Erste Schritte/Initialmaßnahmen fehlen (Management)
  const firstSteps = ["abcde", "sauerstoff", "o2", "monitor", "zugang", "iv", "flüssigkeit", "volumen", "analgesie"];
  if (p === "management" && !hasAny(t, firstSteps)) {
    return "missing_first_steps";
  }

  // 6) Kommunikations-Spot (Closing)
  const patientPhrases = ["ich erkläre", "wir besprechen", "verständ", "fragen sie", "aufklären", "zusammenfassen"];
  if (p === "closing" && !hasAny(t, patientPhrases)) {
    return "communication_blindspot";
  }

  return null;
}

function coachQuestion(flag: CoachFlag) {
  switch (flag) {
    case "missing_redflags":
      return `Kurze Zwischenfrage: Welche Red Flags müssen Sie jetzt aktiv ausschließen? Nennen Sie mir 3. ${TAG(flag)}`;
    case "premature_commitment":
      return `Sie wirken schon recht festgelegt. Geben Sie mir bitte Ihre Top-3-DDx + je 1 Argument pro/contra. ${TAG(flag)}`;
    case "overdiagnostics":
      return `Bevor wir an High-End-Diagnostik denken: Was sind Ihre 2–3 Basisuntersuchungen, die Sie zuerst machen? ${TAG(flag)}`;
    case "no_prioritization":
      return `Priorisieren Sie das bitte: 1 Satz Initial-Plan, dann Diagnostik, dann Therapie. ${TAG(flag)}`;
    case "missing_first_steps":
      return `Was sind Ihre Initialmaßnahmen in den ersten 60 Sekunden? (Stichworte reichen.) ${TAG(flag)}`;
    case "communication_blindspot":
      return `Erklären Sie das bitte patientengerecht in 2–3 Sätzen. ${TAG(flag)}`;
  }
}

/**
 * Liefert NUR den Text (ohne Styling).
 * Styling übernimmt examiner.ts über msgExaminer().
 */
export function maybeCoachInterruption(args: CoachArgs): string | null {
  const flag = detectFlag(args);
  if (!flag) return null;
  if (alreadyAsked(args.messages, flag)) return null;
  return coachQuestion(flag);
}
