import { ChatMessage, SessionConfig } from "../types";
import { CaseTemplate, Phase, phaseForTurn } from "./cases";
import { applyExaminerProfileToText } from "./examinerProfiles";
import { maybeCoachInterruption } from "./coachLogic";

type Focus = {
  phase: Phase;
  label: string;
  level: number;
  kind?: "checklist" | "format";
  format?: "bullets" | "procontra" | "sequence";
};

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function norm(s: string) {
  return (s || "").toLowerCase();
}

function hasAny(text: string, words: string[]) {
  const t = norm(text);
  return words.some((w) => t.includes(w));
}

function tonePrefix(tone: SessionConfig["tone"]) {
  if (tone === "freundlich") return "Alles gut, wir machen das gemeinsam. ";
  if (tone === "streng") return "Kurz und präzise. ";
  return "";
}

function strictness(cfg: SessionConfig) {
  if (cfg.difficulty >= 75) return "Ich will Prioritäten, Red Flags und konkretes Management. ";
  if (cfg.difficulty >= 40) return "Bitte strukturiert und vollständig. ";
  return "Erstmal die Basics sauber. ";
}

function maybeInterruptPrefix(cfg: SessionConfig, mainUserTurns: number) {
  if (cfg.difficulty < 60) return "";
  const every = cfg.difficulty >= 85 ? 1 : 2;
  return mainUserTurns % every === 0 ? "Stopp— " : "";
}

function phaseQuestion(phase: Phase, cfg: SessionConfig, c: CaseTemplate) {
  const hard = cfg.difficulty >= 70;

  if (phase === "intro") return c.startQuestion;

  if (phase === "ddx") {
    return hard
      ? "Nenn mir 3 DDx und jeweils 1 Argument dafür/dagegen."
      : "Welche Differentialdiagnosen kommen dir in den Sinn?";
  }

  if (phase === "diagnostics") {
    return hard
      ? "Welche Diagnostik machst du jetzt konkret – und was erwartest du zu finden?"
      : "Welche Diagnostik würdest du als Nächstes veranlassen?";
  }

  if (phase === "management") {
    return hard
      ? "Management: Was machst du sofort, was innerhalb der nächsten 10 Minuten, und was später?"
      : "Wie sieht dein konkreter Therapie-/Managementplan aus?";
  }

  return hard
    ? "Fasse in 20 Sekunden zusammen: Problem, gefährlichstes Risiko, nächster Schritt."
    : "Fasse kurz zusammen und sag mir deinen nächsten Schritt.";
}

function interruptInstruction(phase: Phase) {
  if (phase === "intro") return "Nur 3 Punkte. Keine Sätze: Stichworte.";
  if (phase === "ddx") return "Gib mir 3 DDx als Stichpunkte.";
  if (phase === "diagnostics") return "Nur 3 Diagnostik-Schritte. Stichpunkte.";
  if (phase === "management") return "Nur 3 Sofortmaßnahmen. Stichpunkte.";
  return "1 Satz Zusammenfassung + 1 nächster Schritt.";
}

function getActiveFocus(history: ChatMessage[]): Focus | null {
  const lastExaminer: any = [...history].reverse().find((m) => m.role === "examiner");
  const f = lastExaminer?.meta?.focus;
  if (!f) return null;

  return {
    phase: f.phase as Phase,
    label: String(f.label),
    level: Number(f.level),
    kind: f.kind as any,
    format: f.format as any,
  };
}

function countMainUserTurns(history: ChatMessage[]) {
  return history.filter((m: any) => m.role === "user" && !m.meta?.followUp).length;
}

function lastMainUserAnswer(history: ChatMessage[]) {
  return [...history].reverse().find((m: any) => m.role === "user" && !m.meta?.followUp);
}

function findChecklistItem(c: CaseTemplate, phase: Phase, label: string) {
  const items = c.checklist?.[phase] ?? [];
  return items.find((it) => it.label === label);
}

function answerCoversChecklistLabel(c: CaseTemplate, phase: Phase, label: string, answerText: string) {
  const it = findChecklistItem(c, phase, label);
  const keywords = (it?.keywords ?? []).map((k) => k.toLowerCase());
  if (keywords.length === 0) return norm(answerText).includes(norm(label));
  return hasAny(answerText, keywords);
}

// ------- Format-Regeln (Prüfer "nervt" realistisch) -------
function bulletSignals(text: string) {
  const t = (text || "").trim();
  const bulletCount = (t.match(/(^|\n)\s*([-•*]|\d+[\).\]])\s+/g) || []).length;
  const lineCount = t.split("\n").filter((l) => l.trim().length > 0).length;
  return { bulletCount, lineCount };
}

function hasProContraWords(text: string) {
  const t = norm(text);
  return t.includes("dafür") || t.includes("dagegen") || t.includes("pro") || t.includes("contra");
}

function answerSatisfiesFocus(c: CaseTemplate, f: Focus, answerText: string) {
  if (f.kind === "format") {
    if (f.format === "bullets") {
      const { bulletCount, lineCount } = bulletSignals(answerText);
      return bulletCount >= 2 || lineCount >= 3;
    }
    if (f.format === "procontra") {
      return hasProContraWords(answerText);
    }
    if (f.format === "sequence") {
      const t = norm(answerText);
      return t.includes("zuerst") || /(^|\n)\s*1[\).\]]/.test(answerText);
    }
    return true;
  }

  return answerCoversChecklistLabel(c, f.phase, f.label, answerText);
}

function followUpText(f: Focus) {
  if (f.kind !== "format") {
    if (f.level === 1) return `Kurz noch: Du hast „${f.label}“ nicht erwähnt. Sag mir dazu 2 Stichpunkte.`;
    if (f.level === 2)
      return `Ganz konkret: Wo/Wie taucht „${f.label}“ in deinem Vorgehen auf? Nenne es in 1–2 kurzen Punkten.`;
    return `Letzte Chance: Nenne „${f.label}“ jetzt in maximal 5 Wörtern (Stichwort reicht).`;
  }

  if (f.format === "bullets") {
    if (f.level === 1) return "Stopp— zu lang. Jetzt bitte in genau 3 Stichpunkten.";
    if (f.level === 2) return "Nein. 3 Stichpunkte, maximal 6 Wörter pro Punkt.";
    return "Letzte Chance: 3 Stichpunkte. Sonst gehen wir weiter.";
  }

  if (f.format === "procontra") {
    if (f.level === 1) return "Du hast Diagnosen genannt, aber keine Begründung: 3 DDx – jeweils 1 Argument dafür UND 1 dagegen.";
    if (f.level === 2) return "Konkreter: pro DDx je 1 Pro und 1 Contra. Kurz.";
    return "Letzte Chance: pro DDx 2 Wörter Pro/Contra.";
  }

  if (f.level === 1) return "Bitte kurz und strukturiert.";
  if (f.level === 2) return "Noch kürzer. Stichpunkte.";
  return "Letzte Chance: 1–2 Stichpunkte.";
}

/**
 * Erzeugt Prüfer-Message + wendet das Prüferprofil auf den Text an
 */
function msgExaminer(cfg: SessionConfig, text: string, focus?: Focus, phaseHint?: Phase): ChatMessage {
  const hint: Phase = (focus?.phase ?? phaseHint ?? "intro") as Phase;

  const base: ChatMessage = {
    id: makeId(),
    role: "examiner",
    ts: Date.now(),
    text,
    meta: focus
      ? {
          focus: {
            phase: focus.phase,
            label: focus.label,
            level: focus.level,
            kind: focus.kind,
            format: focus.format,
          },
        }
      : undefined,
  };

  return {
    ...base,
    text: applyExaminerProfileToText(cfg, base.text, hint as any),
  };
}

// ------- Neue Heuristiken: wann startet der Prüfer ein "Format"-Follow-up? -------
function pickFormatFocus(cfg: SessionConfig, history: ChatMessage[], c: CaseTemplate): Focus | null {
  if (cfg.difficulty < 70) return null;

  const lastMain = lastMainUserAnswer(history);
  if (!lastMain) return null;

  const mainIdx = countMainUserTurns(history) - 1;
  const phaseOfLastMain = phaseForTurn(mainIdx);

  const text = lastMain.text || "";
  const tooLong = text.trim().length > 450;

  if (tooLong) {
    const { bulletCount, lineCount } = bulletSignals(text);
    const alreadyBulletish = bulletCount >= 2 || lineCount >= 3;
    if (!alreadyBulletish) {
      return { phase: phaseOfLastMain, label: "3 Stichpunkte", level: 1, kind: "format", format: "bullets" };
    }
  }

  if (phaseOfLastMain === "ddx") {
    const items = c.checklist?.ddx ?? [];
    const hits = items.filter((it) => hasAny(text, (it.keywords ?? []).map((k) => k.toLowerCase())));
    const listedDDx = hits.length >= 2;
    const hasPC = hasProContraWords(text);
    if (listedDDx && !hasPC) {
      return { phase: "ddx", label: "Pro/Contra", level: 1, kind: "format", format: "procontra" };
    }
  }

  return null;
}

function pickMissingLabelFromLastMain(
  cfg: SessionConfig,
  history: ChatMessage[],
  c: CaseTemplate
): { phase: Phase; label: string } | null {
  if (cfg.difficulty < 55) return null;

  const lastMain = lastMainUserAnswer(history);
  if (!lastMain) return null;

  const mainIdx = countMainUserTurns(history) - 1;
  const phaseOfLastMain = phaseForTurn(mainIdx);

  const items = c.checklist?.[phaseOfLastMain] ?? [];
  if (items.length === 0) return null;

  const t = norm(lastMain.text);
  const hits = items.filter((it) => hasAny(t, (it.keywords ?? []).map((k) => k.toLowerCase())));
  const misses = items.filter((it) => !hasAny(t, (it.keywords ?? []).map((k) => k.toLowerCase())));

  const tooShort = lastMain.text.trim().length < (cfg.difficulty >= 70 ? 150 : 95);
  const tooFewHits = hits.length < Math.min(2, items.length);

  if (!tooShort && !tooFewHits) return null;
  if (misses.length === 0) return null;

  return { phase: phaseOfLastMain, label: misses[0].label };
}

// ------- Exports -------
export function initialExaminerMessage(cfg: SessionConfig, c: CaseTemplate): ChatMessage {
  const text = `${tonePrefix(cfg.tone)}Prüfungssimulation (${cfg.fachrichtung}). ${strictness(cfg)}${c.startQuestion}`;
  return msgExaminer(cfg, text, undefined, "intro");
}

export function interruptExaminerMessage(cfg: SessionConfig, history: ChatMessage[], c: CaseTemplate): ChatMessage {
  const mainTurns = countMainUserTurns(history);
  const phase = phaseForTurn(mainTurns);
  const text = `Stopp— ${tonePrefix(cfg.tone)}${interruptInstruction(phase)}`;
  return msgExaminer(cfg, text, undefined, phase);
}

export function nextExaminerMessage(cfg: SessionConfig, history: ChatMessage[], c: CaseTemplate): ChatMessage {
  const active = getActiveFocus(history);
  const mainTurns = countMainUserTurns(history);

  if (active) {
    if (active.level >= 3) {
      const phase = phaseForTurn(mainTurns);
      const text = `${tonePrefix(cfg.tone)}Okay. Wir gehen weiter: ${phaseQuestion(phase, cfg, c)}`;
      return msgExaminer(cfg, text, undefined, phase);
    }
    const nextF: Focus = { ...active, level: active.level + 1 };
    const text = `${tonePrefix(cfg.tone)}${followUpText(nextF)}`;
    return msgExaminer(cfg, text, nextF, nextF.phase);
  }

  const phase = phaseForTurn(mainTurns);
  const interrupt = maybeInterruptPrefix(cfg, mainTurns);
  const text = `${interrupt}${tonePrefix(cfg.tone)}${phaseQuestion(phase, cfg, c)}`;
  return msgExaminer(cfg, text, undefined, phase);
}

export function nextExaminerMessageAfterUser(cfg: SessionConfig, history: ChatMessage[], c: CaseTemplate): ChatMessage {
  const active = getActiveFocus(history);
  const mainTurns = countMainUserTurns(history);

  // 1) Wenn Fokus aktiv: prüfen, ob erfüllt
  if (active) {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const ok = lastUser ? answerSatisfiesFocus(c, active, lastUser.text) : false;

    if (ok) {
      const phase = phaseForTurn(mainTurns);
      const interrupt = maybeInterruptPrefix(cfg, mainTurns);
      const text = `${interrupt}${tonePrefix(cfg.tone)}Gut. ${phaseQuestion(phase, cfg, c)}`;
      return msgExaminer(cfg, text, undefined, phase);
    }

    if (active.level >= 3) {
      const phase = phaseForTurn(mainTurns);
      const text = `${tonePrefix(cfg.tone)}Okay. Wir gehen weiter: ${phaseQuestion(phase, cfg, c)}`;
      return msgExaminer(cfg, text, undefined, phase);
    }

    const nextF: Focus = { ...active, level: active.level + 1 };
    const text = `${tonePrefix(cfg.tone)}${followUpText(nextF)}`;
    return msgExaminer(cfg, text, nextF, nextF.phase);
  }

  // 2) Coach-Unterbrechung (Rule-based)
  // -> wir beurteilen nur die LETZTE Haupt-Antwort (nicht FollowUp)
  const lastMain = lastMainUserAnswer(history);
  if (lastMain) {
    const phaseOfLastMain = phaseForTurn(mainTurns - 1);
    const coachText = maybeCoachInterruption({
      messages: history as any,
      phase: phaseOfLastMain,
      userText: lastMain.text ?? "",
      cfg,
      checklistItems: c.checklist?.[phaseOfLastMain] ?? undefined,
    });

    if (coachText) {
      return msgExaminer(cfg, `${tonePrefix(cfg.tone)}${coachText}`, undefined, phaseOfLastMain);
    }
  }

  // 3) Format-Fokus (zu lang / ddx ohne pro/contra)
  const formatFocus = pickFormatFocus(cfg, history, c);
  if (formatFocus) {
    const text = `${tonePrefix(cfg.tone)}${followUpText(formatFocus)}`;
    return msgExaminer(cfg, text, formatFocus, formatFocus.phase);
  }

  // 4) Inhaltlicher Fokus (fehlender Checklist-Punkt)
  const start = pickMissingLabelFromLastMain(cfg, history, c);
  if (start) {
    const f: Focus = { phase: start.phase, label: start.label, level: 1, kind: "checklist" };
    const text = `${tonePrefix(cfg.tone)}${followUpText(f)}`;
    return msgExaminer(cfg, text, f, f.phase);
  }

  // 5) Sonst normal weiter
  const phase = phaseForTurn(mainTurns);
  const interrupt = maybeInterruptPrefix(cfg, mainTurns);
  const text = `${interrupt}${tonePrefix(cfg.tone)}${phaseQuestion(phase, cfg, c)}`;
  return msgExaminer(cfg, text, undefined, phase);
}
