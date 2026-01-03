// src/logic/leitsymptom.ts
import type { CaseTemplate } from "./cases";

export type LeitsymptomCluster = {
  id: string;
  label: string;
  keywords: string[];
};

export const LEITSYMPTOM_CLUSTERS: LeitsymptomCluster[] = [
  {
    id: "thoraxschmerz",
    label: "Thoraxschmerz",
    keywords: ["thorax", "brust", "angina", "acs", "infarkt", "lungenembolie", "pleur", "aorten", "perikard"],
  },
  {
    id: "dyspnoe",
    label: "Dyspnoe",
    keywords: ["dysp", "atemnot", "asthma", "copd", "lungenödem", "pneumonie", "sao2", "sättigung", "bga"],
  },
  {
    id: "bauchschmerz",
    label: "Bauchschmerz",
    keywords: ["bauch", "abdomen", "append", "chole", "pankreat", "ileus", "periton", "divert", "kolik"],
  },
  {
    id: "fieber_sepsis",
    label: "Fieber / Sepsis",
    keywords: ["fieber", "sepsis", "schüttel", "infekt", "pneumonie", "harnwegs", "pyelo", "crp", "prokalzitonin"],
  },
  {
    id: "kopfschmerz_neuro",
    label: "Kopfschmerz / Neuro",
    keywords: ["kopfschmerz", "neurol", "schlaganfall", "tia", "parese", "aphasie", "mening", "sab", "krampf"],
  },
  {
    id: "synkope_schwindel",
    label: "Synkope / Schwindel",
    keywords: ["synkope", "kollaps", "schwindel", "präsynkope", "orthostat", "arrhythm", "ekg", "brady", "tachy"],
  },
  {
    id: "blutung_anämie",
    label: "Blutung / Anämie",
    keywords: ["blutung", "hämatemesis", "meläna", "hämatochezie", "anämie", "hb", "transfusion", "gerinnung", "marcumar"],
  },
  {
    id: "trauma",
    label: "Trauma / Fraktur",
    keywords: ["trauma", "fraktur", "sturz", "schmerz", "hämatom", "roentgen", "ct", "gips", "op", "polytrauma"],
  },
  {
    id: "urologie_niere",
    label: "Flankenschmerz / Uro",
    keywords: ["flanke", "kolik", "stein", "harn", "dysurie", "pyelo", "hydronephrose", "sonographie", "kreatinin"],
  },
  {
    id: "gyn_schwangerschaft",
    label: "Gyn / Schwangerschaft",
    keywords: ["schwanger", "ssw", "unterbauch", "blutung", "ektop", "präeklam", "wehen", "ctg", "vaginal"],
  },
  {
    id: "peds_kind",
    label: "Pädiatrie (Kind)",
    keywords: ["kind", "säugling", "fieberkrampf", "pseudokrupp", "bronchiolit", "dehydrat", "exsikkose", "impf"],
  },
  {
    id: "intensiv_schock",
    label: "Schock / Intensiv",
    keywords: ["schock", "abcde", "vasopressor", "noradrenalin", "intub", "beatm", "laktat", "sepsis", "reanimation"],
  },
];

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function caseBlob(c: CaseTemplate) {
  const parts: string[] = [];
  parts.push(c.title ?? "");
  parts.push(c.vignette ?? "");
  parts.push(c.startQuestion ?? "");

  // Checklist mit reinnehmen (Labels + Keywords)
  const checklist: any = (c as any).checklist ?? {};
  const phases = Object.keys(checklist);
  for (const p of phases) {
    const items = checklist[p] ?? [];
    for (const it of items) {
      parts.push(String(it?.label ?? ""));
      const kws = it?.keywords ?? [];
      if (Array.isArray(kws)) parts.push(kws.join(" "));
    }
  }

  return norm(parts.join(" "));
}

export function getClusterById(id: string) {
  return LEITSYMPTOM_CLUSTERS.find((c) => c.id === id) ?? null;
}

/**
 * Filtert Fälle nach Fachrichtung + Cluster-Keywords.
 * Liefert nach "Match-Score" sortiert (mehr Keyword-Treffer = weiter oben).
 */
export function getCasesForCluster(params: {
  cases: CaseTemplate[];
  fachrichtung: string;
  clusterId: string;
}) {
  const { cases, fachrichtung, clusterId } = params;

  const pool = cases.filter((c) => c.fachrichtung === fachrichtung);
  const cluster = getClusterById(clusterId);

  if (!cluster) {
    return { pool, matches: pool, clusterLabel: "Unbekannt" };
  }

  const scored = pool
    .map((c) => {
      const blob = caseBlob(c);
      const score = cluster.keywords.reduce((acc, kw) => (blob.includes(norm(kw)) ? acc + 1 : acc), 0);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return { pool, matches: scored.map((x) => x.c), clusterLabel: cluster.label };
}
