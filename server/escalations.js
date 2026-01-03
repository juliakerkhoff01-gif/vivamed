// server/escalations.js
// Kleine “Eskalations-Bibliothek”: medizinisch + organisatorisch.
// Wichtig: Diese Textbausteine sind absichtlich kurz (1 Zeile), damit du die “1 Frage / max 2 Sätze”-Regel hältst.

function pick(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  function norm(s) {
    return String(s ?? "").toLowerCase();
  }
  
  // grobe Fach-Matcher (damit Innere/Chirurgie usw. etwas anders eskalieren)
  function inferDomain(fachrichtung, vignette, title) {
    const t = norm(`${fachrichtung} ${vignette} ${title}`);
    if (/gyn|schwanger|geburt|eileiter|ovarial|uterus/.test(t)) return "gyn";
    if (/päd|kind|säugling|neugebor/.test(t)) return "peds";
    if (/chir|abdomen|appendi|ileus|wunde|trauma|fraktur/.test(t)) return "surgery";
    if (/neuro|schlaganfall|krampf|lähm|kopfschmerz|bewusst/.test(t)) return "neuro";
    if (/kardio|brustschmerz|infarkt|ekg|herz|tachy|brady/.test(t)) return "cardio";
    if (/pneumo|dyspnoe|asthma|copd|sättigung|sp02|husten/.test(t)) return "pulm";
    return "internal";
  }
  
  const BASE = {
    // “allgemein” (fast überall plausibel)
    intro_med: [
      "Neue Info: Der Patient wirkt deutlich blasser und klagt über zunehmende Schwäche.",
      "Neue Info: Der Patient berichtet jetzt über Schüttelfrost seit heute Morgen.",
      "Neue Info: Auf Nachfrage: relevante Vorerkrankung/Medikation war bisher nicht genannt (z.B. Antikoagulation).",
    ],
    intro_org: [
      "Stationsrealität: Die Pflege drängt – der Patient soll gleich zur Untersuchung, du hast 30 Sekunden für Prioritäten.",
      "Stationsrealität: Alte Befunde fehlen im System, du musst ohne Vorwerte entscheiden.",
      "Stationsrealität: Angehörige sind verunsichert und stellen parallel Fragen – du musst trotzdem strukturiert bleiben.",
    ],
  
    ddx_med: [
      "Neue Info: Es kommt ein neuer Leitsymptom-Hinweis hinzu (z.B. Thoraxschmerz/neurologische Ausfälle).",
      "Neue Info: Der Patient wirkt jetzt deutlich dyspnoisch.",
      "Neue Info: Der Patient berichtet über plötzlich einsetzende starke Schmerzen.",
    ],
    ddx_org: [
      "Stationsrealität: Du darfst nur 3 DDx nennen – und musst die gefährlichste zuerst priorisieren.",
      "Stationsrealität: Du sollst in 20 Sekunden sagen, welche Diagnose du auf keinen Fall verpassen darfst.",
      "Stationsrealität: Der Oberarzt fragt: 'Was ist der Worst-Case, den wir jetzt sofort ausschließen müssen?'",
    ],
  
    diagnostics_med: [
      "Neue Info: Ein erster Befund kommt rein (z.B. EKG auffällig / Labor zeigt Entzündung / BGA zeigt Hypoxie).",
      "Neue Info: Vitalparameter ändern sich (z.B. RR fällt / HF steigt).",
      "Neue Info: Bildgebung ist verzögert – du musst mit dem arbeiten, was du jetzt hast.",
    ],
    diagnostics_org: [
      "Stationsrealität: CT ist erst in 2 Stunden möglich – welche Diagnostik machst du bis dahin?",
      "Stationsrealität: Labor ist auf dem Weg, aber du musst jetzt entscheiden: was ist der nächste beste Schritt?",
      "Stationsrealität: Du hast nur 2 Untersuchungen frei – welche bringen dich am weitesten?",
    ],
  
    management_med: [
      "Neue Info: Verschlechterung – der Patient wird hypotensiv (Kreislauf instabil).",
      "Neue Info: Verschlechterung – die Sättigung fällt trotz O2-Gabe.",
      "Neue Info: Verschlechterung – Bewusstseinslage nimmt ab / Patient wird somnolent.",
    ],
    management_org: [
      "Stationsrealität: Du bekommst einen Anruf: 'Wir haben nur 1 Bett auf IMC' – wen priorisierst du und warum?",
      "Stationsrealität: Es ist Schichtwechsel – du musst ein 20-Sekunden-Handover geben (Problem, Gefahr, nächster Schritt).",
      "Stationsrealität: Die Pflege fragt: 'Was ist die eine Maßnahme, die ich jetzt SOFORT umsetzen soll?'",
    ],
  
    closing_med: [
      "Neue Info: Kurz vor Abschluss fragt der Patient nach Risiken/Nebenwirkungen der nächsten Maßnahme.",
      "Neue Info: Der Patient berichtet eine neue Red Flag, die du einordnen musst.",
    ],
    closing_org: [
      "Stationsrealität: Der Patient will nach Hause – wie erklärst du kurz Risiko + Plan?",
      "Stationsrealität: Du musst in 1–2 Sätzen die Patientenerklärung liefern (verständlich, ohne Fachjargon).",
    ],
  };
  
  // domain-spezifische Add-ons (optional, aber hilft für Realismus)
  const DOMAIN = {
    cardio: {
      management_med: [
        "Neue Info: Verschlechterung – der Patient bekommt Rhythmusprobleme/Palpitationen, wirkt kaltschweißig.",
        "Neue Info: Verschlechterung – thorakales Druckgefühl nimmt zu.",
      ],
      diagnostics_med: [
        "Neue Info: EKG zeigt neue Ischämiezeichen / Rhythmusstörung (unspezifisch, aber ernst).",
      ],
    },
    pulm: {
      management_med: [
        "Neue Info: Verschlechterung – Atemarbeit steigt, der Patient kann kaum noch ganze Sätze sprechen.",
      ],
      diagnostics_med: [
        "Neue Info: BGA deutet auf respiratorische Problematik (z.B. CO2-Anstieg) hin.",
      ],
    },
    neuro: {
      ddx_med: ["Neue Info: Neurologische Symptomatik progredient (z.B. Sprachstörung/Armparese)."],
      management_med: ["Neue Info: Verschlechterung – Vigilanz nimmt weiter ab."],
    },
    surgery: {
      ddx_med: ["Neue Info: Akutes Abdomen – Abwehrspannung/Peritonismus wird beschrieben."],
      diagnostics_org: ["Stationsrealität: OP-Kapazität ist knapp – welche Info brauchst du JETZT zur OP-Indikation?"],
    },
    gyn: {
      ddx_med: ["Neue Info: Zyklus/Schwangerschaft ist unklar – es besteht potenziell Schwangerschaftsrisiko."],
    },
    peds: {
      intro_med: ["Neue Info: Eltern berichten über Trinkschwäche/Reduktion der nassen Windeln."],
    },
  };
  
  function keyForPhase(phase, kind) {
    // phase: intro|ddx|diagnostics|management|closing
    // kind: med|org
    return `${phase}_${kind}`;
  }
  
  export function buildEscalationLine({ fachrichtung, phase, vignette, title }) {
    const domain = inferDomain(fachrichtung, vignette, title);
  
    // 60% medizinisch, 40% organisatorisch (du wolltest beides)
    const kind = Math.random() < 0.6 ? "med" : "org";
    const key = keyForPhase(phase, kind);
  
    // Base candidates
    const baseCandidates = BASE[key] ?? [];
  
    // Domain candidates (falls vorhanden)
    const domainCandidates = (DOMAIN?.[domain]?.[key] ?? []);
  
    // Mischpool (domain etwas bevorzugen, wenn vorhanden)
    const pool =
      domainCandidates.length > 0
        ? [...domainCandidates, ...domainCandidates, ...baseCandidates]
        : [...baseCandidates];
  
    return pick(pool) ?? null;
  }
  