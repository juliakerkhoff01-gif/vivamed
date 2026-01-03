export type ExaminerTone = "freundlich" | "neutral" | "streng";

export type SessionConfig = {
  fachrichtung: string;

  /** optional: nur relevant wenn fachrichtung === "Innere Medizin" */
  innereSubfach?: string; // z.B. "Kardiologie" | "Gastroenterologie" | ... | "all"

  tone: ExaminerTone;
  difficulty: number; // 0..100
  caseId?: string; // optional: konkreter Fall
  mode?: "text" | "voice"; // schriftlich oder mündlich
  examinerProfile?: "standard" | "redflag" | "guidelines" | "communication" | "rapidfire";
};

export type ChatRole = "examiner" | "user" | "system";

export type ChatMessageMeta = {
  // Wenn true: diese User-Antwort zählt NICHT als neue Phase (sie ist Antwort auf ein Follow-up)
  followUp?: boolean;

  // Follow-up-Fokus: entweder "checklist" (inhaltlich) oder "format" (Form/Struktur)
  focus?: {
    phase: string; // "intro" | "ddx" | "diagnostics" | "management" | "closing"
    label: string; // z.B. "Troponin" oder "3 Stichpunkte"
    level: number; // 1..3
    kind?: "checklist" | "format";
    format?: "bullets" | "procontra" | "sequence";
  };
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
  meta?: ChatMessageMeta;
};

export type FeedbackSheet = {
  performance: { title: string; score: number; note: string }[];
  content: { title: string; score: number; note: string }[];
  topImprovements: string[];
};
