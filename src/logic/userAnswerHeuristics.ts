import { ChatMessage, SessionConfig } from "../types";
import { CaseTemplate } from "./cases";

type Verdict = "good" | "ok" | "weak";

function containsAny(text: string, needles: string[]) {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

function scoreAnswer(text: string, focusLabel?: string): { verdict: Verdict; hits: string[] } {
  const hits: string[] = [];

  const hasStructure = /(^|\n)\s*[-•\d]/.test(text) || /\b(erstens|zweitens|drittens)\b/i.test(text);
  if (hasStructure) hits.push("struktur");

  const genericGood = ["vital", "abc", "monitor", "oxygen", "sauerstoff", "iv", "zugang", "ekg", "labor", "bildgebung"];
  if (containsAny(text, genericGood)) hits.push("akut");

  if (focusLabel) {
    if (containsAny(text, [focusLabel])) hits.push("focus");
  }

  if (hits.includes("focus") && (hits.includes("struktur") || hits.includes("akut"))) return { verdict: "good", hits };
  if (hits.includes("focus") || hits.includes("struktur") || hits.includes("akut")) return { verdict: "ok", hits };
  return { verdict: "weak", hits };
}

export function examinerFollowUpAfterUserAnswer(
  cfg: SessionConfig,
  prevNoSystem: ChatMessage[],
  theCase: CaseTemplate,
  userText: string,
  focus: { phase: string; label: string; level: number; kind?: "checklist" | "format"; format?: string }
): ChatMessage {
  const { verdict } = scoreAnswer(userText, focus.label);

  let text = `Okay.\nBezogen auf „${focus.label}“: `;

  if (verdict === "good") {
    text +=
      `Das ist schlüssig.\n` +
      `Welche Alternative würde Sie am ehesten umstimmen – und welches Argument spricht dagegen?`;
  } else if (verdict === "ok") {
    text +=
      `Teilweise richtig, aber ich möchte es präziser hören.\n` +
      `Nennen Sie mir bitte Ihre Top-2 Punkte und begründen Sie kurz.`;
  } else {
    text +=
      `Das ist mir zu unscharf.\n` +
      `Was ist Ihre konkrete Arbeitshypothese, und welche nächste Maßnahme folgt daraus?`;
  }

  return {
    id: Math.random().toString(16).slice(2),
    role: "examiner",
    text,
    ts: Date.now(),
    meta: {
      focus: {
        phase: focus.phase,
        label: focus.label,
        level: Math.min(3, (focus.level ?? 1) + 1),
        kind: focus.kind ?? "checklist",
      },
    },
  };
}
