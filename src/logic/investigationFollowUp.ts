// src/logic/investigationFollowUp.ts
import { ChatMessage, SessionConfig } from "../types";
import { CaseTemplate } from "./cases";
import { OrderedTest } from "./investigations";

/** Extrahiert z.B. CRP 78 aus "CRP 78 mg/l" */
function extractNumber(label: string, text: string): number | null {
  // tolerant: "CRP 78", "CRP: 78", "CRP=78", "CRP 78 mg/l"
  const re = new RegExp(`${label}\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function normalizePhase(p: string): string {
  // falls mal was anderes kommt, geben wir es trotzdem als string weiter
  return p || "diagnostics";
}

export function examinerMessageAfterInvestigation(
  cfg: SessionConfig,
  prevNoSystem: ChatMessage[],
  theCase: CaseTemplate,
  ordered: OrderedTest,
  phase: string
): ChatMessage {
  const ph = normalizePhase(phase);

  const label = ordered.item.label;
  const summary = ordered.item.result.summary ?? "";
  const details = ordered.item.result.details?.join(" ") ?? "";
  const full = `${summary} ${details}`.trim();

  // Baseline-Frage (immer passend)
  let question =
    `Gut. Sie haben ${label} veranlasst.\n` +
    `Wie interpretieren Sie den Befund – und was bedeutet das für Ihre nächste Vorgehensweise?`;

  // Heuristiken nach Kategorie / Schlüsselwörtern
  if (ordered.item.category === "LAB") {
    const crp = extractNumber("CRP", full);
    const leuko = extractNumber("Leuko", full);

    const highInflammation =
      (crp !== null && crp >= 50) || (leuko !== null && leuko >= 12);

    if (highInflammation) {
      question =
        `Die Entzündungswerte sind deutlich erhöht.\n` +
        `Was ist Ihre wahrscheinlichste Diagnose und welche zwei Differenzialdiagnosen müssen Sie aktiv ausschließen?\n` +
        `Welche Therapie leiten Sie jetzt sofort ein?`;
    } else {
      question =
        `Die Laborwerte sind eher unauffällig.\n` +
        `Wie wirkt sich das auf Ihre Differenzialdiagnosen aus – und welche Diagnostik würden Sie als Nächstes gezielt anfordern?`;
    }

    if (ph === "management") {
      question += `\nUnd welches Monitoring/Verlaufskontrollen planen Sie?`;
    }
  }

  if (ordered.item.category === "EKG") {
    const isAf = /vorhofflimmern|absolute arrhythmie/i.test(full);
    const isSTEMI = /st[-\s]?hebung/i.test(full);

    if (isSTEMI) {
      question =
        `Das EKG ist hochkritisch.\n` +
        `Welche Sofortmaßnahmen ergreifen Sie jetzt – und wen rufen Sie sofort dazu?`;
    } else if (isAf) {
      question =
        `Das EKG spricht für Vorhofflimmern.\n` +
        `Was ist Ihr Akut-Management (Frequenz vs. Rhythmus) und wie beurteilen Sie die Indikation zur Antikoagulation?`;
      if (ph === "diagnostics") {
        question += `\nWelche Ursachen/Trigger klären Sie parallel ab?`;
      }
    } else {
      question =
        `Bitte beschreiben Sie den EKG-Befund strukturiert.\n` +
        `Welche Konsequenz hat das für Ihre nächste Diagnostik bzw. Therapie?`;
    }
  }

  if (ordered.item.category === "ROENTGEN") {
    const infiltrate = /infiltrat|verschattung|konsolidierung/i.test(full);
    const pneumothorax = /pneumothorax/i.test(full);
    const effusion = /pleuraerguss/i.test(full);

    if (pneumothorax) {
      question =
        `Im Röntgen zeigt sich ein Pneumothorax.\n` +
        `Wie behandeln Sie das jetzt – und wovon machen Sie die Dringlichkeit abhängig?`;
    } else if (infiltrate) {
      question =
        `Im Röntgen sieht man ein Infiltrat.\n` +
        `Welche Diagnose ist am wahrscheinlichsten – und wie behandeln Sie leitlinienorientiert?\n` +
        `Welche Kriterien entscheiden über stationär vs. ambulant?`;
      if (effusion) {
        question += `\nUnd wie gehen Sie mit dem Pleuraerguss weiter um?`;
      }
    } else {
      question =
        `Das Röntgen ergibt keinen eindeutigen Leitsymptom-Befund.\n` +
        `Wie geht es diagnostisch weiter – und welche Differenzialdiagnosen bleiben oben?`;
    }
  }
  if (ordered.item.category === "BGA") {
    const ph = normalizePhase(phase);
    const lactate = extractNumber("Lactat", full);
    const pH = extractNumber("pH", full);

    const bad = (lactate !== null && lactate >= 2.5) || (pH !== null && pH < 7.32);

    if (bad) {
      question =
        `Die BGA ist deutlich pathologisch.\n` +
        `Welche Ursache ist am wahrscheinlichsten und welche 3 Sofortmaßnahmen leiten Sie ein?\n` +
        `Wie würden Sie das Monitoring und die Verlaufskontrolle planen?`;
      if (ph === "diagnostics") question += `\nWelche Diagnostik zur Ursachensuche läuft parallel?`;
    } else {
      question =
        `Die BGA ist relativ unauffällig.\n` +
        `Wie beeinflusst das Ihre Arbeitshypothese und was ist Ihr nächster diagnostischer Schritt?`;
    }
  }

  if (ordered.item.category === "CT") {
    const bleed = /blutung|hämorrhag|intrazerebral/i.test(full);
    const stroke = /ischämi|infarkt/i.test(full);

    if (bleed) {
      question =
        `Das CT zeigt eine akute Blutung.\n` +
        `Was tun Sie jetzt sofort (Akutmanagement) und welche Medikamente sind kontraindiziert?\n` +
        `Welche Fachdisziplinen binden Sie ein?`;
    } else if (stroke) {
      question =
        `Das CT passt zu einem ischämischen Ereignis.\n` +
        `Welche Therapiefenster/Optionen prüfen Sie und welche Kriterien entscheiden darüber?`;
    } else {
      question =
        `Im CT zeigt sich kein eindeutiger Leitsymptom-Befund.\n` +
        `Wie gehen Sie jetzt weiter vor – und was sind Ihre Top-3 Differenzialdiagnosen?`;
    }
  }

  if (ordered.item.category === "SONO") {
    const appy = /appendix|appendiz/i.test(full);
    const gall = /gallenblase|cholezyst|gallenstein/i.test(full);
    const freeFluid = /flüssigkeit|ascites|freie flüssigkeit/i.test(full);

    if (appy) {
      question =
        `Die Sonographie ist vereinbar mit Appendizitis.\n` +
        `Wie ist Ihr weiteres Vorgehen – und welche Red Flags würden Sie sofort operativ werden lassen?\n` +
        `Welche perioperative Antibiotikastrategie würden Sie wählen?`;
    } else if (gall) {
      question =
        `Die Sonographie passt zu einer biliären Ursache.\n` +
        `Wie behandeln Sie akut und welche Kriterien sprechen für stationär/Intervention?`;
    } else if (freeFluid) {
      question =
        `Es zeigt sich freie Flüssigkeit.\n` +
        `Wie interpretieren Sie das im Kontext – und welche Diagnostik/Intervention folgt als nächstes?`;
    } else {
      question =
        `Der Sono-Befund ist nicht eindeutig richtungsweisend.\n` +
        `Wie gehen Sie weiter vor, um Ihre führenden Differenzialdiagnosen abzusichern?`;
    }
  }


  // Fokus setzen, damit die nächste User-Antwort als followUp zählt (und NICHT Turn/Phase voranschiebt)
  const focus = {
    phase: ph,
    label,
    level: 1,
    kind: "checklist" as const,
  };

  return {
    id: Math.random().toString(16).slice(2),
    role: "examiner",
    text: question,
    ts: Date.now(),
    meta: { focus },
  };
}
