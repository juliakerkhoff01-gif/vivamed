export type ExaminerProfile =
  | "standard"
  | "redflag"
  | "guidelines"
  | "communication"
  | "rapidfire";

export function getExaminerProfile(cfg: any): ExaminerProfile {
  return (cfg?.examinerProfile ?? "standard") as ExaminerProfile;
}

export function profileLabel(p: ExaminerProfile) {
  if (p === "redflag") return "Red-Flag Hunter";
  if (p === "guidelines") return "Leitlinien-Fan";
  if (p === "communication") return "Kommunikativ";
  if (p === "rapidfire") return "Rapid-Fire";
  return "Standard";
}

export function interruptMultiplier(cfg: any) {
  const p = getExaminerProfile(cfg);
  // kleiner = früher unterbrechen, größer = später
  if (p === "rapidfire") return 0.45;
  if (p === "redflag") return 0.50;
  if (p === "communication") return 0.65;
  if (p === "guidelines") return 0.55;
  return 0.55;
}

function firstLine(s: string) {
  const t = (s ?? "").trim();
  const nl = t.indexOf("\n");
  return nl >= 0 ? t.slice(0, nl).trim() : t;
}

export function applyExaminerProfileToText(cfg: any, text: string, phase?: string) {
  const p = getExaminerProfile(cfg);
  const base = (text ?? "").trim();
  if (!base) return base;

  if (p === "rapidfire") {
    // knapper + klare Erwartung
    const short = firstLine(base);
    return `Kurz & knapp:\n${short}\n\nAntwort bitte in 1–2 Sätzen.`;
  }

  if (p === "redflag") {
    return `${base}\n\nZusatz: Nennen Sie 2–3 Red Flags/gefährliche Ausschlüsse, die Sie sofort bedenken.`;
  }

  if (p === "guidelines") {
    return `${base}\n\nZusatz: Was ist das leitliniengerechte initiale Vorgehen (kurz, als Algorithmus)?`;
  }

  if (p === "communication") {
    return `${base}\n\nZusatz: Formulieren Sie das als Patientenerklärung in 1–2 Sätzen.`;
  }

  return base; // standard
}
