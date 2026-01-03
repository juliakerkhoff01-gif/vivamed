import { ChatMessage, SessionConfig } from "../types";
import { getAiBaseUrl } from "./appSettings";

export type AiFeedbackReport = {
  overall: { score: number; one_liner: string };
  medical: {
    likely_dx: string[];
    dangerous_ddx_missing: string[];
    diagnostics_next_best: string[];
    management_next_best: string[];
    red_flags: string[];
  };
  communication: {
    structure: { score: number; note: string };
    prioritization: { score: number; note: string };
    clarity: { score: number; note: string };
    empathy: { score: number; note: string };
  };
  top3_strengths: string[];
  top3_improvements: string[];
  next_time_script: {
    opening: string;
    ddx: string;
    diagnostics: string;
    management: string;
    closing: string;
  };
  drills: Array<{ title: string; why: string; how: string }>;
};

function withTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(t) };
}

function normalizeBaseUrlLight(input: any): string {
  let s = String(input ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  s = s.replace(/\/+$/, "");
  return s;
}

/**
 * Holt KI-Feedback vom Server.
 * - baseUrl optional (override) -> wird light-normalisiert
 * - sonst -> AppSettings.aiBaseUrl (normalisiert)
 */
export async function fetchAiFeedbackReport(params: {
  baseUrl?: string;
  cfg: SessionConfig;
  generatedCase: any; // CaseTemplate (oder null)
  messages: ChatMessage[];
}): Promise<AiFeedbackReport | null> {
  const override = normalizeBaseUrlLight(params.baseUrl);
  const baseUrl = override || (await getAiBaseUrl());

  if (!baseUrl) {
    throw new Error(
      "feedback-report failed: Keine Server-URL gesetzt. Bitte in Einstellungen eine URL eintragen (z.B. http://192.168.x.x:8787)."
    );
  }

  const { controller, clear } = withTimeout(20000);

  try {
    const resp = await fetch(`${baseUrl}/api/feedback-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        cfg: params.cfg,
        generatedCase: params.generatedCase,
        messages: params.messages,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`feedback-report failed: ${resp.status} ${t}`);
    }

    const data = await resp.json();
    return (data?.report ?? null) as AiFeedbackReport | null;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/aborted|abort/i.test(msg)) {
      throw new Error(
        "feedback-report failed: Timeout (Server antwortet nicht). Prüfe WLAN/IP/Firewall und teste /health."
      );
    }
    throw new Error(`feedback-report failed: ${msg}`);
  } finally {
    clear();
  }
}
