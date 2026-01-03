import { getAiBaseUrl } from "./appSettings";

export type UiMessage = { role: "user" | "examiner"; text: string };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(t) };
}

// gleiche “light” Normalisierung wie in UI: scheme + trailing slash weg
function normalizeBaseUrlLight(input: any): string {
  let s = String(input ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  s = s.replace(/\/+$/, "");
  return s;
}

/**
 * Holt die nächste Prüfer-Frage vom Server.
 * baseUrl ist optional:
 * - wenn übergeben => wird genutzt (light normalisiert)
 * - sonst => wird aus AppSettings.aiBaseUrl geladen (normalisiert)
 */
export async function fetchExaminerTurn(params: {
  baseUrl?: string; // optional override
  cfg: any;
  generatedCase: any | null;
  messages: UiMessage[];
}): Promise<string> {
  const { cfg, generatedCase, messages } = params;

  const override = normalizeBaseUrlLight(params.baseUrl);
  const baseUrl = override || (await getAiBaseUrl());
  console.log("[AI] baseUrl =", baseUrl);

  if (!baseUrl) {
    throw new Error(
      "examiner-turn failed: Keine Server-URL gesetzt. Bitte in Einstellungen eine URL eintragen (z.B. http://192.168.x.x:8787)."
    );
  }

  const { controller, clear } = withTimeout(20000);

  try {
    const r = await fetch(`${baseUrl}/api/examiner-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ cfg, generatedCase, messages }),
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`examiner-turn failed: ${r.status} ${t}`);
    }

    const data = await r.json();
    return String(data?.text ?? "").trim();
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/aborted|abort/i.test(msg)) {
      throw new Error("examiner-turn failed: Timeout (Server antwortet nicht). Prüfe WLAN/IP/Firewall und teste /health.");
    }
    throw new Error(`examiner-turn failed: ${msg}`);
  } finally {
    clear();
  }
}
