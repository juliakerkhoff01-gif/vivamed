// server/index.js (ESM)
//
// Lokal:   OPENAI_API_KEY=... PORT=8787 npm run dev
// Render:  setzt PORT automatisch, OPENAI_API_KEY + OPENAI_MODEL (+ optional Transcribe/Realtime) in Render Env setzen
//
// Features:
// - SSE Streaming: /api/examiner-turn
// - Speech-to-text (OpenAI): /api/transcribe (multipart/form-data, field "file")
// - Speech-to-text (Google STT v2): /api/stt (multipart/form-data, field "file")
// - Realtime Token: /api/realtime-token (Ephemeral client_secret für WebRTC)
// - Examiner meta: assessment + investigations(performed/newlyPerformed)
// - ✅ Case generation: /api/generate-case
//
// NOTE:
// - Für /api/transcribe brauchst du: npm i multer
// - Für /api/stt (Google) brauchst du: npm i @google-cloud/speech
//   + Render Env: GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-sa.json
//   + Render Env: GCP_PROJECT_ID=examecho-2026   (oder GOOGLE_CLOUD_PROJECT)

import express from "express";
import cors from "cors";
import multer from "multer";
import { createRequire } from "module";
import { buildEscalationLine } from "./escalations.js";

const require = createRequire(import.meta.url);

const BUILD_TAG = "health-v14-2026-01-26-devfeedback-esm-require-fix";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("etag", false);

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const HOST = "0.0.0.0";

// Models
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

// Realtime defaults (optional in env)
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

// ---- CORS ----
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Client", "X-Admin-Token", "Accept"],
  })
);
app.options("*", cors());

// Basic headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

// Body parser
app.use(express.json({ limit: "2mb" }));

// ---- Mini Request Logger ----
app.use((req, _res, next) => {
  const t = new Date().toISOString();
  console.log(`[${t}] ${req.method} ${req.path}`);
  next();
});

// ---- Dev Feedback (CJS module loaded from ESM via createRequire) ----
try {
  const { attachDevFeedback } = require("./devFeedback.js");
  if (typeof attachDevFeedback === "function") {
    attachDevFeedback(app);
    console.log("[devFeedback] attached routes: POST /api/dev-feedback, GET /admin/feedback(.json)");
  } else {
    console.warn("[devFeedback] attachDevFeedback not found/exported.");
  }
} catch (e) {
  console.error("[devFeedback] failed to load/attach:", e);
}

// ----------------------------
// Helpers
// ----------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeTrim(s, max = 1200) {
  const str = String(s ?? "");
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

function extractJsonObject(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;

  try {
    return JSON.parse(s);
  } catch {}

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
  return null;
}

function sanitizeText(t) {
  let s = String(t ?? "").trim();
  if (!s) return "";
  s = s.replace(/\bDDx\b/gi, "Differentialdiagnosen");
  s = s.replace(/\bDx\b/gi, "Diagnose");
  s = s.replace(/\bTx\b/gi, "Therapie");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function dedupeConsecutiveLines(text) {
  const lines = String(text ?? "")
    .split("\n")
    .map((l) => l.trimEnd());
  const out = [];
  for (const l of lines) {
    if (!l.trim()) {
      if (out.length && out[out.length - 1] === "") continue;
      out.push("");
      continue;
    }
    if (out.length && out[out.length - 1] === l) continue;
    out.push(l);
  }
  return out.join("\n").trim();
}

function dedupeIfRepeatedBlock(text) {
  const s = String(text ?? "").trim();
  if (!s) return s;
  const half = Math.floor(s.length / 2);
  if (s.length % 2 === 0) {
    const a = s.slice(0, half);
    const b = s.slice(half);
    if (a === b) return a.trim();
  }
  return s;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    const cleaned = sanitizeText(data.output_text);
    return dedupeConsecutiveLines(dedupeIfRepeatedBlock(cleaned));
  }

  const texts = [];
  const out = Array.isArray(data?.output) ? data.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (typeof c?.text === "string" && c.text.trim()) texts.push(c.text);
      else if (typeof c?.content === "string" && c.content.trim()) texts.push(c.content);
    }
    if (typeof item?.text === "string" && item.text.trim()) texts.push(item.text);
  }

  const maybeChat =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.result?.content;

  if (typeof maybeChat === "string" && maybeChat.trim()) texts.push(maybeChat);

  const seen = new Set();
  const uniq = [];
  for (const t of texts) {
    const s = String(t ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
  }

  const cleaned = sanitizeText(uniq.join("\n").trim());
  return dedupeConsecutiveLines(dedupeIfRepeatedBlock(cleaned));
}

function normalizeExamDay(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (s === "tag1" || s === "t1" || s === "1") return "tag1";
  if (s === "tag2" || s === "t2" || s === "2") return "tag2";
  if (s === "sim" || s === "simulation" || s === "tag1tag2" || s === "tag1->tag2") return "sim";
  return "sim";
}

function normalizeTag2Style(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (s === "no_patient_reference" || s === "no_patient" || s === "no-patient") return "no_patient_reference";
  return "with_reference";
}

function examDayLabel(day) {
  if (day === "tag1") return "Tag 1";
  if (day === "tag2") return "Tag 2";
  return "Simulation (Tag 1→2)";
}

function reasoningEffortForDifficulty(difficulty) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);
  if (d >= 85) return "high";
  if (d >= 70) return "medium";
  return "low";
}

function lastExaminerUtterance(openAiLikeMessages) {
  const last = [...openAiLikeMessages].reverse().find((m) => m.role === "assistant");
  return String(last?.content ?? "").trim();
}

function lastUserAnswer(openAiLikeMessages) {
  const last = [...openAiLikeMessages].reverse().find((m) => m.role === "user");
  return String(last?.content ?? "").trim();
}

function countUserTurns(openAiLikeMessages) {
  return openAiLikeMessages.filter((m) => m.role === "user").length;
}

function sliceLastTurns(openAiLikeMessages, maxTurns = 14) {
  if (!Array.isArray(openAiLikeMessages)) return [];
  if (openAiLikeMessages.length <= maxTurns) return openAiLikeMessages;
  return openAiLikeMessages.slice(-maxTurns);
}

// ----------------------------
// In-memory “Memory” pro Session
// ----------------------------
const memoryStore = new Map();
// sessionId -> { examStage, performedInv, updatedAt }

// ----------------------------
// Investigations gating (server-side detect: mentioned)
// ----------------------------
const INV_ALIASES = [
  { id: "ekg", pats: [/(\bekg\b|\becg\b|12[\s-]?kanal)/i] },
  { id: "troponin", pats: [/\btroponin\b/i] },
  { id: "bga", pats: [/\bbga\b|blutgasanalyse/i] },
  { id: "roentgen_thorax", pats: [/r(ö|oe)ntgen.*thorax|\bcxr\b|\bthorax\s*r(ö|oe)ntgen\b/i] },
  { id: "auskultation", pats: [/auskult/i] },
  { id: "sono", pats: [/\bsono\b|\bsonographie\b|\bultraschall\b/i] },
];

function detectInvestigations(text) {
  const s = String(text ?? "");
  const hits = [];
  for (const a of INV_ALIASES) {
    if (a.pats.some((re) => re.test(s))) hits.push(a.id);
  }
  return [...new Set(hits)];
}

function getOrInitSessionState(sessionId) {
  const prev = memoryStore.get(sessionId) || {};
  return {
    ...prev,
    performedInv: Array.isArray(prev.performedInv) ? prev.performedInv : [],
    updatedAt: Date.now(),
  };
}

function getSessionId(cfg, fallbackSessionId) {
  const raw = String(cfg?.sessionId ?? cfg?.sessionID ?? cfg?.sid ?? "").trim();
  if (raw) return raw;
  const alt = String(fallbackSessionId ?? "").trim();
  return alt || null;
}

// ----------------------------
// Escalation: never show "Verschärfung:"
// ----------------------------
function shouldEscalate({ difficulty, messages }) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);
  const turns = messages.filter((m) => m.role === "user").length;
  if (turns < 1) return false;

  const p = d >= 85 ? 0.35 : d >= 70 ? 0.25 : d >= 45 ? 0.15 : 0.08;

  const lastFew = messages
    .slice(-4)
    .map((m) => (m.role === "assistant" ? m.content : ""))
    .join(" ");

  const alreadyEscalatedRecently = /Update:|Zustand verschlechtert|Sättigung fällt|RR fällt|plötzlich/i.test(lastFew);

  if (alreadyEscalatedRecently) return Math.random() < p * 0.35;
  return Math.random() < p;
}

// ----------------------------
// OpenAI helpers
// ----------------------------
const _fetch = globalThis.fetch;

async function openaiJsonCall({ apiKey, url, body, reqId, timeoutMs = 45000 }) {
  if (!_fetch) throw new Error("Missing global fetch in this Node runtime");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await _fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[openai][${reqId}] error ${resp.status}:`, errText?.slice?.(0, 2500));
      const e = new Error(`OpenAI error ${resp.status}`);
      e.status = resp.status;
      e.detail = errText;
      throw e;
    }

    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function openaiResponsesCall({ apiKey, body, reqId, timeoutMs = 45000 }) {
  return openaiJsonCall({
    apiKey,
    url: "https://api.openai.com/v1/responses",
    body,
    reqId,
    timeoutMs,
  });
}

async function openaiTranscribeCall({
  apiKey,
  fileBuffer,
  filename,
  mimeType,
  language = "de",
  prompt,
  reqId,
  timeoutMs = 45000,
}) {
  if (!_fetch) throw new Error("Missing global fetch in this Node runtime");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType || "application/octet-stream" });

    form.append("file", blob, filename || "audio.m4a");
    form.append("model", TRANSCRIBE_MODEL);
    if (language) form.append("language", String(language));
    if (prompt) form.append("prompt", String(prompt));

    const resp = await _fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[openai][${reqId}] transcribe error ${resp.status}:`, errText?.slice?.(0, 2500));
      const e = new Error(`OpenAI transcribe error ${resp.status}`);
      e.status = resp.status;
      e.detail = errText;
      throw e;
    }

    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------
// Google Speech-to-Text v2 helper (via require for ESM-compat)
// ----------------------------
function getGcpProjectId() {
  return String(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "").trim() || null;
}

function hasGoogleCredentialsConfigured() {
  // In Render: GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-sa.json
  return Boolean(String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim());
}

async function googleRecognizeV2({ fileBuffer, languageCode = "de-DE", reqId }) {
  const projectId = getGcpProjectId();
  if (!projectId) {
    const e = new Error("Missing GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) env var");
    e.code = "missing_project_id";
    throw e;
  }

  // Lazy-load so the server still boots without the package in dev
  const speechPkg = require("@google-cloud/speech"); // needs: npm i @google-cloud/speech
  const SpeechClient = speechPkg?.v2?.SpeechClient;
  if (!SpeechClient) {
    const e = new Error("Failed to load @google-cloud/speech v2 SpeechClient (check package install)");
    e.code = "missing_speech_client";
    throw e;
  }

  const client = new SpeechClient();

  const recognizer = `projects/${projectId}/locations/global/recognizers/_`;
  const audioBytes = Buffer.from(fileBuffer).toString("base64");

  const request = {
    recognizer,
    config: {
      autoDecodingConfig: {}, // key for handling m4a/etc without explicit encoding
      languageCodes: [String(languageCode || "de-DE")],
      model: "latest_long",
    },
    content: audioBytes,
  };

  const t0 = Date.now();
  const [resp] = await client.recognize(request);
  const ms = Date.now() - t0;

  const transcript =
    (resp?.results || [])
      .map((r) => (r?.alternatives || [])[0]?.transcript || "")
      .join(" ")
      .trim();

  return {
    text: transcript,
    meta: {
      provider: "google",
      api: "speech-to-text-v2",
      build: BUILD_TAG,
      ms,
      languageCode: String(languageCode || "de-DE"),
      recognizer,
      reqId,
    },
  };
}

// ----------------------------
// SSE helpers
// ----------------------------
function sseInit(req, res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Content-Encoding", "identity");
  res.setHeader("Vary", "Origin");

  res.flushHeaders?.();
  res.write(":ok\n\n");

  const pingEveryMs = 12_000;
  const pingTimer = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      res.flush?.();
    } catch {}
  }, pingEveryMs);

  const cleanup = () => clearInterval(pingTimer);
  req.on("close", cleanup);
  req.on("end", cleanup);

  return { cleanup };
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  res.flush?.();
}

async function sseStreamText(req, res, text, meta) {
  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  sseSend(res, "meta", meta ?? {});

  const s = String(text ?? "");
  const chunkSize = 18;

  for (let i = 0; i < s.length; i += chunkSize) {
    if (closed) return;
    sseSend(res, "delta", s.slice(i, i + chunkSize));
    await new Promise((r) => setTimeout(r, 8));
  }

  if (!closed) sseSend(res, "done", { ok: true });
  try {
    res.end();
  } catch {}
}

// ----------------------------
// /health
// ----------------------------
app.get("/", (_req, res) => res.redirect("/health"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "examecho-server",
    port: PORT,
    time: new Date().toISOString(),
    env: process.env.RENDER ? "render" : "local",
    build: BUILD_TAG,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: DEFAULT_MODEL,
    transcribeModel: TRANSCRIBE_MODEL,
    realtimeModel: REALTIME_MODEL,
    realtimeVoice: REALTIME_VOICE,
    gcpProjectId: getGcpProjectId(),
    hasGoogleCreds: hasGoogleCredentialsConfigured(),
  });
});

// ============================
// /api/realtime-token
// ============================
app.post("/api/realtime-token", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const instructions =
      String(req.body?.instructions ?? "").trim() || "Du bist ExamEcho. Antworte kurz, medizinisch, auf Deutsch.";
    const wantText = Boolean(req.body?.wantText ?? true);

    const model = String(req.body?.model ?? REALTIME_MODEL).trim() || REALTIME_MODEL;
    const voice = String(req.body?.voice ?? REALTIME_VOICE).trim() || REALTIME_VOICE;

    const turn_detection = { type: "server_vad" };

    const body = {
      model,
      voice,
      instructions,
      modalities: wantText ? ["audio", "text"] : ["audio"],
      turn_detection,
    };

    const reqId = `rt-${Math.random().toString(16).slice(2)}`;
    const t0 = Date.now();

    const data = await openaiJsonCall({
      apiKey,
      url: "https://api.openai.com/v1/realtime/sessions",
      body,
      reqId,
      timeoutMs: 45_000,
    });

    const dt = Date.now() - t0;
    const cs = data?.client_secret ?? null;

    if (!cs) {
      return res.status(500).json({
        error: "realtime-token failed",
        detail: "No client_secret returned by OpenAI",
        raw: safeTrim(JSON.stringify(data), 1200),
      });
    }

    return res.json({
      client_secret: cs,
      meta: { provider: "openai", build: BUILD_TAG, ms: dt, model, voice, modalities: body.modalities },
    });
  } catch (e) {
    const status = Number(e?.status ?? 500);
    const detail = e?.detail ?? String(e?.message ?? e);
    console.error("[realtime-token] error:", e);

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "realtime-token failed",
      status,
      detail: String(detail).slice(0, 4000),
      build: BUILD_TAG,
    });
  }
});

// ============================
// /api/transcribe (OpenAI Whisper)
// ============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

async function handleTranscribe(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: "Missing audio file. Send multipart/form-data with field 'file'." });
    }

    const language = String(req.body?.language ?? req.body?.lang ?? "de").trim() || "de";
    const prompt = String(req.body?.prompt ?? "").trim() || undefined;

    const reqId = `tr-${Math.random().toString(16).slice(2)}`;
    const t0 = Date.now();

    const out = await openaiTranscribeCall({
      apiKey,
      fileBuffer: file.buffer,
      filename: file.originalname || "audio.m4a",
      mimeType: file.mimetype,
      language,
      prompt,
      reqId,
      timeoutMs: 60_000,
    });

    const text = String(out?.text ?? "").trim();
    const dt = Date.now() - t0;

    return res.json({
      text,
      meta: { provider: "openai", build: BUILD_TAG, model: TRANSCRIBE_MODEL, ms: dt, language },
    });
  } catch (e) {
    const status = Number(e?.status ?? 500);
    const detail = e?.detail ?? String(e?.message ?? e);
    console.error("[transcribe] error:", e);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "transcribe failed",
      detail: String(detail).slice(0, 4000),
      build: BUILD_TAG,
    });
  }
}

// ============================
// /api/stt (Google STT v2, fallback to OpenAI)
// ============================
async function handleStt(req, res) {
  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ error: "Missing audio file. Send multipart/form-data with field 'file'." });
  }

  const lang = String(req.body?.language ?? req.body?.lang ?? "de-DE").trim() || "de-DE";
  const reqId = `stt-${Math.random().toString(16).slice(2)}`;

  // 1) Try Google first (if configured)
  try {
    if (!hasGoogleCredentialsConfigured()) {
      throw Object.assign(new Error("Google credentials not configured (missing GOOGLE_APPLICATION_CREDENTIALS)"), {
        code: "missing_google_creds",
      });
    }

    const out = await googleRecognizeV2({
      fileBuffer: file.buffer,
      languageCode: lang,
      reqId,
    });

    return res.json(out);
  } catch (e) {
    console.warn("[stt] google failed, falling back to OpenAI:", e?.code || e?.message || e);

    // 2) Fallback to OpenAI Whisper (so your beta still works)
    try {
      // Reuse your existing OpenAI transcribe logic:
      // We call openaiTranscribeCall directly so meta is "stt" endpoint
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "stt failed",
          detail: "Google STT failed and OPENAI_API_KEY is missing (cannot fallback).",
          googleError: String(e?.message ?? e).slice(0, 2000),
          build: BUILD_TAG,
        });
      }

      const language = lang.startsWith("de") ? "de" : lang.slice(0, 2);
      const t0 = Date.now();

      const openaiOut = await openaiTranscribeCall({
        apiKey,
        fileBuffer: file.buffer,
        filename: file.originalname || "audio.m4a",
        mimeType: file.mimetype,
        language,
        prompt: String(req.body?.prompt ?? "").trim() || undefined,
        reqId: `stt-fallback-${reqId}`,
        timeoutMs: 60_000,
      });

      const dt = Date.now() - t0;

      return res.json({
        text: String(openaiOut?.text ?? "").trim(),
        meta: {
          provider: "openai",
          build: BUILD_TAG,
          model: TRANSCRIBE_MODEL,
          ms: dt,
          language,
          fallbackFromGoogle: true,
          googleError: String(e?.message ?? e).slice(0, 600),
        },
      });
    } catch (e2) {
      const status = Number(e2?.status ?? 500);
      const detail = e2?.detail ?? String(e2?.message ?? e2);
      console.error("[stt] fallback openai failed:", e2);

      return res.status(status >= 400 && status < 600 ? status : 500).json({
        error: "stt failed",
        detail: String(detail).slice(0, 4000),
        googleError: String(e?.message ?? e).slice(0, 2000),
        build: BUILD_TAG,
      });
    }
  }
}

app.post("/api/transcribe", upload.single("file"), handleTranscribe);
app.post("/api/transcription", upload.single("file"), handleTranscribe);
app.post("/api/stt", upload.single("file"), handleStt);

// ============================
// ✅ /api/generate-case
// ============================
const caseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 3, maxLength: 80 },
    title: { type: "string", minLength: 6, maxLength: 120 },
    vignette: { type: "string", minLength: 40, maxLength: 1200 },
    startQuestion: { type: "string", minLength: 10, maxLength: 220 },
    keyFindings: { type: "array", items: { type: "string", maxLength: 120 }, minItems: 3, maxItems: 8 },
    checklist: { type: "array", items: { type: "string", maxLength: 140 }, minItems: 6, maxItems: 16 },
  },
  required: ["id", "title", "vignette", "startQuestion", "keyFindings", "checklist"],
};

function normalizeGeneratedCase(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const id = String(c.id ?? `gen_${Date.now()}`).trim() || `gen_${Date.now()}`;
  const title = String(c.title ?? "Generierter Fall").trim() || "Generierter Fall";
  const vignette = String(c.vignette ?? "—").trim() || "—";
  const startQuestion = String(c.startQuestion ?? "Wie gehen Sie initial vor?").trim() || "Wie gehen Sie initial vor?";
  const keyFindings = Array.isArray(c.keyFindings) ? c.keyFindings.map((x) => String(x).trim()).filter(Boolean) : [];
  const checklist = Array.isArray(c.checklist) ? c.checklist.map((x) => String(x).trim()).filter(Boolean) : [];

  return {
    id: id.slice(0, 80),
    title: title.slice(0, 120),
    vignette: vignette.slice(0, 1200),
    startQuestion: startQuestion.slice(0, 220),
    keyFindings: keyFindings.slice(0, 8),
    checklist: checklist.slice(0, 16),
  };
}

app.post("/api/generate-case", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const cfg = req.body?.cfg ?? {};
    const seedHint = String(req.body?.seedHint ?? "").trim();

    const fachrichtung = String(cfg?.fachrichtung ?? "Innere Medizin").trim() || "Innere Medizin";
    const innereSubfach = String(cfg?.innereSubfach ?? "all").trim() || "all";
    const tone = String(cfg?.tone ?? "neutral").trim() || "neutral";
    const difficulty = clamp(Number(cfg?.difficulty ?? 65), 0, 100);
    const examDay = normalizeExamDay(cfg?.examDay ?? "sim");
    const aiModeRaw = String(cfg?.aiMode ?? "").trim().toLowerCase();
    const aiMode = aiModeRaw === "exam" || aiModeRaw === "training" ? aiModeRaw : difficulty >= 70 ? "exam" : "training";

    const model = DEFAULT_MODEL;
    const reqId = `case-${Math.random().toString(16).slice(2)}`;
    const t0 = Date.now();

    const system = `
Du generierst EINEN neuen klinischen Prüfungsfall für eine mündliche Medizinprüfung (Deutsch).
Ziel: realistische Vignette + passende Startfrage + Checkliste für Bewertung.

WICHTIGE REGELN:
- Gib AUSSCHLIESSLICH JSON nach Schema aus (keinen Fließtext davor/danach).
- Kein "Verschärfung:" und keine Meta-Kommentare.
- Der Fall muss zur Fachrichtung passen. Wenn Fachrichtung breit ist, wähle ein typisches, prüfungsrelevantes Leitsymptom.
- Keine unnötig exotischen Fälle. Lieber häufig + gefährliche DDx im Hinterkopf.
- Vignette: realistisch (Setting, Alter, Beschwerden, wichtige Basisinfos).
- Startfrage: eine klare Prüferfrage (genau 1 Frage).
- keyFindings: 3–8 Dinge, die die/der Kandidat sinnvollerweise erheben sollte.
- checklist: 6–16 Punkte (Anamnese/KU/DDx/Diagnostik/Management je nach ExamDay).

RAHMEN:
- Fach: ${fachrichtung}${innereSubfach && innereSubfach !== "all" ? ` (${innereSubfach})` : ""}
- Ton: ${tone}
- Schwierigkeit: ${difficulty}/100
- ExamDay: ${examDayLabel(examDay)} (Tag1=Bedside, Tag2=Fachgespräch, Sim=Mix)
- Modus: ${aiMode}
${seedHint ? `- Seed-Hinweis: ${seedHint}` : ""}
`.trim();

    const body = {
      model,
      store: false,
      reasoning: { effort: "medium" },
      input: [{ role: "system", content: system }],
      max_output_tokens: 520,
      text: { format: { type: "json_schema", strict: true, name: "examecho_case", schema: caseSchema } },
    };

    const data = await openaiResponsesCall({ apiKey, body, reqId, timeoutMs: 45_000 });

    const parsed = data?.output_parsed ?? extractJsonObject(extractOutputText(data));
    if (!parsed || typeof parsed !== "object") {
      return res.status(500).json({
        error: "generate-case failed",
        detail: "AI returned non-JSON",
        build: BUILD_TAG,
      });
    }

    const c = normalizeGeneratedCase(parsed);
    const dt = Date.now() - t0;

    return res.json({
      case: c,
      meta: { provider: "openai", build: BUILD_TAG, model, ms: dt, fachrichtung, examDay, aiMode },
    });
  } catch (e) {
    const status = Number(e?.status ?? 500);
    const detail = e?.detail ?? String(e?.message ?? e);
    console.error("[generate-case] error:", e);

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "generate-case failed",
      detail: String(detail).slice(0, 4000),
      build: BUILD_TAG,
    });
  }
});

// ============================
// /api/examiner-turn (SSE optional)
// ============================
const SIM_SWITCH_TURNS = 3;

function resolveExamStage({ examDay, userTurns, sessionId }) {
  const day = normalizeExamDay(examDay);
  if (day === "tag1" || day === "tag2") return day;

  const inferred = userTurns >= SIM_SWITCH_TURNS ? "tag2" : "tag1";
  if (!sessionId) return inferred;

  const prev = memoryStore.get(sessionId);
  const prevStage = prev?.examStage === "tag2" ? "tag2" : prev?.examStage === "tag1" ? "tag1" : null;
  const nextStage = prevStage === "tag2" ? "tag2" : inferred;

  if (!prev || prevStage !== nextStage) {
    memoryStore.set(sessionId, { ...(prev || {}), examStage: nextStage, updatedAt: Date.now() });
  }
  return nextStage;
}

function inferPhaseFromTurns(openAiLikeMessages, examStage) {
  const userTurns = countUserTurns(openAiLikeMessages);

  if (examStage === "tag1") {
    if (userTurns <= 1) return "intro";
    if (userTurns <= 3) return "bedside";
    if (userTurns === 4) return "diagnostics";
    if (userTurns === 5) return "management";
    return "closing";
  }

  if (userTurns <= 1) return "ddx";
  if (userTurns === 2) return "diagnostics";
  if (userTurns === 3) return "management";
  return "closing";
}

function miniFeedbackStyleForDifficulty(difficulty) {
  const d = clamp(Number(difficulty ?? 65), 0, 100);
  if (d < 35) return { enabled: true, style: "sehr freundlich, 1 Mini-Lob + 1 sanfter Verbesserungspunkt." };
  if (d < 55) return { enabled: true, style: "freundlich-neutral: 1 Satz (loben + klarer Punkt)." };
  if (d < 70) return { enabled: true, style: "prüfungsnah: 1 Satz, größte Lücke + nächster Schritt." };
  return { enabled: false, style: "kein Feedback" };
}

// Output schema: 1 Frage + assessment
const examinerTurnSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lead: { type: "string", maxLength: 140 },
    reaction: { type: "string", minLength: 4, maxLength: 220, pattern: "^[^?]+$" },
    question: { type: "string", minLength: 6, maxLength: 260, pattern: "^.+\\?$" },
    feedback: { type: "string", maxLength: 220, pattern: "^[^?]+$" },

    assessment: {
      type: "object",
      additionalProperties: false,
      properties: {
        verdict: { type: "string", enum: ["correct", "partial", "wrong", "unsafe", "unclear"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        depth: { type: "string", enum: ["surface", "ok", "deep"] },
        missing_critical: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
        errors: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 3 },
      },
      required: ["verdict", "confidence", "depth", "missing_critical", "errors"],
    },
  },
  required: ["reaction", "question", "assessment"],
};

function normalizeOneQuestion(q) {
  let s = String(q ?? "").trim();
  if (!s) return "";
  const firstQ = s.indexOf("?");
  if (firstQ >= 0) s = s.slice(0, firstQ + 1);
  if (!s.endsWith("?")) s = s + "?";
  return sanitizeText(s).trim();
}

function normalizeLine(s, maxLen) {
  let t = sanitizeText(String(s ?? "").trim());
  t = t.replace(/\s+/g, " ").trim();
  if (maxLen) t = safeTrim(t, maxLen);
  return t;
}

function composeExaminerText({ lead, reaction, question, feedback, miniFeedbackEnabled }) {
  const lines = [];
  const leadClean = normalizeLine(lead, 160);
  if (leadClean) lines.push(leadClean);

  const reactionClean = normalizeLine(reaction, 220);
  if (reactionClean) lines.push(reactionClean);

  const questionClean = normalizeOneQuestion(question);
  if (questionClean) lines.push(questionClean);

  if (miniFeedbackEnabled) {
    const fb = normalizeLine(feedback, 220);
    if (fb) lines.push(`Feedback: ${fb.startsWith("Feedback:") ? fb.replace(/^Feedback:\\s*/i, "") : fb}`);
  }

  return dedupeConsecutiveLines(dedupeIfRepeatedBlock(lines.join("\n").trim()));
}

function isTipRequest(text) {
  const s = String(text ?? "").toLowerCase();
  return /\btipp\b/.test(s) || /hinweis/.test(s) || /hilfe/.test(s) || /help/.test(s);
}

function isIDontKnow(text) {
  const s = String(text ?? "").toLowerCase();
  return /weiß ich nicht|weiss ich nicht|keine ahnung|keine idee|kann ich nicht|keine antwort|nicht sicher|null plan/i.test(s);
}

function isVeryShort(text) {
  const s = String(text ?? "").trim();
  return s.length > 0 && s.length < 18;
}

function lastNUserAnswers(openAiLikeMessages, n = 3) {
  const users = openAiLikeMessages.filter((m) => m.role === "user").map((m) => String(m.content ?? ""));
  return users.slice(-n);
}

function detectBlocked(openAiLikeMessages) {
  const last = lastNUserAnswers(openAiLikeMessages, 3);
  if (last.length === 0) return { blocked: false, reason: null };

  const dontKnowCount = last.filter(isIDontKnow).length;
  const last2 = last.slice(-2);
  const twoShortInARow = last2.length === 2 && last2.every(isVeryShort);

  if (dontKnowCount >= 2) return { blocked: true, reason: "dont_know" };
  if (twoShortInARow) return { blocked: true, reason: "very_short" };

  return { blocked: false, reason: null };
}

function fallbackExaminerTurn({ userLast, phase, escalationLine, mfEnabled, examStage, tag2Style }) {
  const quote = userLast
    ? `"${userLast.slice(0, 55).replace(/\n/g, " ")}${userLast.length > 55 ? "…" : ""}"`
    : null;

  const tag2NoPatient = tag2Style === "no_patient_reference";
  const tag2Prefix = tag2NoPatient ? "In diesem Fall: " : "";
  const tag2Suffix = tag2NoPatient ? " (ohne Patient*innen-Ansprache)" : "";

  let q = "";

  if (examStage === "tag1") {
    if (phase === "intro") q = "Welche zwei gezielten Anamnesefragen stellen Sie jetzt zuerst?";
    else if (phase === "bedside") q = "Welche zwei Befunde erheben Sie bei der körperlichen Untersuchung jetzt gezielt?";
    else if (phase === "diagnostics") q = "Welche nächste Diagnostik ist jetzt am effizientesten – und warum genau diese?";
    else if (phase === "management") q = "Was sind Ihre ersten Sofortmaßnahmen in den nächsten 5–10 Minuten?";
    else q = "Was ist Ihr kurzes Zwischenfazit – und welcher Punkt bleibt kritisch offen?";
  } else {
    if (phase === "ddx") q = `${tag2Prefix}Nennen Sie drei wichtige Differentialdiagnosen und je ein Pro/Contra.${tag2Suffix}`;
    else if (phase === "diagnostics") q = `${tag2Prefix}Was ist die nächste beste Diagnostik – und welche Befunde erwarten Sie?${tag2Suffix}`;
    else if (phase === "management") q = `${tag2Prefix}Wie ist Ihr Management in den nächsten 10 Minuten – Prioritäten?${tag2Suffix}`;
    else q = `${tag2Prefix}Was ist Ihre Abschlussdiagnose – und welche zwei Risiken müssen Sie aktiv ausschließen?${tag2Suffix}`;
  }

  const lines = [];
  if (escalationLine) lines.push(`Update: ${escalationLine}`);
  lines.push(quote ? `Okay – Sie sagen ${quote}.` : "Okay.");
  lines.push(q);
  if (mfEnabled) lines.push("Feedback: Strukturieren Sie kurz (Problem → Priorität → nächster Schritt).");
  return lines.join("\n");
}

async function handleExaminerTurn(req, res) {
  try {
    const { cfg, generatedCase, messages, sessionId: sessionIdBody } = req.body ?? {};
    if (!cfg || !Array.isArray(messages)) return res.status(400).json({ error: "Missing cfg or messages" });

    const fachrichtung = String(cfg?.fachrichtung ?? "Innere Medizin");
    const innereSubfach = String(cfg?.innereSubfach ?? "all");
    const tone = String(cfg?.tone ?? "neutral");
    const difficulty = clamp(Number(cfg?.difficulty ?? 65), 0, 100);
    const examinerProfile = String(cfg?.examinerProfile ?? "standard");

    const aiModeRaw = String(cfg?.aiMode ?? "").trim().toLowerCase();
    const aiMode = aiModeRaw === "training" || aiModeRaw === "exam" ? aiModeRaw : difficulty < 70 ? "training" : "exam";

    const wantStream =
      Boolean(cfg?.stream) ||
      String(req.query?.stream ?? "") === "1" ||
      String(req.headers.accept ?? "").includes("text/event-stream");

    if (wantStream) sseInit(req, res);

    const sessionId = getSessionId(cfg, sessionIdBody);
    const examDay = normalizeExamDay(cfg?.examDay ?? "sim");
    const tag2Style = normalizeTag2Style(cfg?.tag2Style ?? "with_reference");

    const caseTitle = String(generatedCase?.title ?? "");
    const vignette = String(generatedCase?.vignette ?? "");
    const startQuestion = String(generatedCase?.startQuestion ?? "");
    const checklist = generatedCase?.checklist ?? null;

    const asOpenAiLike = messages
      .filter((m) => m && (m.role === "user" || m.role === "examiner" || m.role === "system"))
      .map((m) => ({
        role: m.role === "examiner" ? "assistant" : m.role === "system" ? "system" : "user",
        content: String(m.text ?? ""),
      }));

    const userTurns = countUserTurns(asOpenAiLike);
    const examStage = resolveExamStage({ examDay, userTurns, sessionId });
    const phase = inferPhaseFromTurns(asOpenAiLike, examStage);

    const escalate = shouldEscalate({ difficulty, messages: asOpenAiLike });
    const escalationLine = escalate ? buildEscalationLine({ fachrichtung, phase, vignette, title: caseTitle }) : null;

    const mf = miniFeedbackStyleForDifficulty(difficulty);

    const userLast = lastUserAnswer(asOpenAiLike);

    // investigations meta
    const sessionState = sessionId ? getOrInitSessionState(sessionId) : null;
    const detectedInv = detectInvestigations(userLast);
    const newlyPerformed = sessionState ? detectedInv.filter((id) => !sessionState.performedInv.includes(id)) : detectedInv;
    if (sessionState && newlyPerformed.length) {
      sessionState.performedInv = [...new Set([...sessionState.performedInv, ...newlyPerformed])];
      sessionState.updatedAt = Date.now();
      memoryStore.set(sessionId, sessionState);
    }

    const blockedState = detectBlocked(asOpenAiLike);
    const userAskedTip = isTipRequest(userLast);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const out = { error: "Missing OPENAI_API_KEY env var" };
      if (wantStream) {
        sseSend
        (res, "error", out);
        return res.end();
      }
      return res.status(500).json(out);
    }

    const model = DEFAULT_MODEL;
    const reasoningEffort = reasoningEffortForDifficulty(difficulty);

    const caseContext = `
FALLKONTEXT:
Titel: ${caseTitle}
Vignette: ${vignette}
Startfrage: ${startQuestion}
Checkliste (intern):
${checklist ? JSON.stringify(checklist).slice(0, 6000) : "—"}
`.trim();

    const escalationInstruction = escalationLine
      ? `Wenn eine Zustandsänderung nötig ist, integriere sie maximal als EINE kurze Zeile ohne Label. Beispiel: "Update: ${escalationLine}".`
      : `Keine Zustandsänderung in diesem Turn.`;

    const systemInstructions = `
Du bist ein sehr realistischer medizinischer Prüfer (Deutsch) für eine mündliche Prüfung.

WICHTIGE REGELN:
1) Pro Turn GENAU EINE Frage (genau 1 Fragezeichen).
2) Reagiere direkt auf die letzte Kandidatenantwort (1 kurzer Satz).
3) Keine Meta-Kommentare. Keine Labels wie "Verschärfung:".
4) Keine Tabellen, keine Bullet-Listen. Max. 3–4 kurze Zeilen.

Rahmen:
- Fach: ${fachrichtung}
- Unterfach: ${innereSubfach}
- Ton: ${tone}
- Schwierigkeit: ${difficulty}/100
- Profil: ${examinerProfile}
- Modus: ${aiMode}
- ExamDay: ${examDayLabel(examDay)} / Stage: ${examDayLabel(examStage)} / Phase: ${phase}
- Tag2Style: ${tag2Style}

Blockade:
- blocked=${blockedState.blocked ? "JA" : "NEIN"} reason=${blockedState.reason ?? "—"}
Regel:
- Wenn blocked und Training: 1 kurzer Hinweis (max 1 Satz), dann 1 Frage.

Tipp:
- Wenn explizit Tipp gefragt (${userAskedTip ? "JA" : "NEIN"}): genau EINEN Hinweis-Satz, dann 1 Frage.

${escalationInstruction}

OUTPUT:
- JSON nach Schema.
- reaction: 1 Satz ohne Fragezeichen.
- question: exakt 1 Frage, endet mit "?".
- assessment: immer ausfüllen.
`.trim();

    const convoWindow = sliceLastTurns(asOpenAiLike, 18);
    const reqId = Math.random().toString(16).slice(2);
    const t0 = Date.now();

    const body = {
      model,
      store: false,
      reasoning: { effort: reasoningEffort },
      input: [
        { role: "system", content: systemInstructions },
        { role: "system", content: safeTrim(caseContext, 4200) },
        ...convoWindow,
      ],
      max_output_tokens: 320,
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "examecho_examiner_turn",
          schema: examinerTurnSchema,
        },
      },
    };

    let usedFallback = false;

    const data = await openaiResponsesCall({ apiKey, reqId, timeoutMs: 45_000, body });
    let parsed = data?.output_parsed ?? extractJsonObject(extractOutputText(data));

    if (!parsed || typeof parsed !== "object") {
      usedFallback = true;
      const fallback = fallbackExaminerTurn({
        userLast,
        phase,
        escalationLine,
        mfEnabled: mf.enabled,
        examStage,
        tag2Style,
      });

      const meta = {
        provider: "openai",
        build: BUILD_TAG,
        mode: aiMode,
        examDay,
        examStage,
        tag2Style,
        phase,
        tipAsked: Boolean(userAskedTip),
        blocked: blockedState,
        fallbackUsed: true,
        streaming: wantStream,
        model,
        assessment: { verdict: "unclear", confidence: 0.45, depth: "surface", missing_critical: [], errors: [] },
        investigations: { performed: sessionState?.performedInv ?? [], newlyPerformed },
      };

      if (wantStream) return sseStreamText(req, res, fallback, meta);
      return res.json({ text: fallback, meta });
    }

    if (!parsed.assessment || typeof parsed.assessment !== "object") {
      parsed.assessment = { verdict: "unclear", confidence: 0.5, depth: "surface", missing_critical: [], errors: [] };
    }

    const text = composeExaminerText({
      lead: parsed.lead,
      reaction: parsed.reaction,
      question: parsed.question,
      feedback: parsed.feedback,
      miniFeedbackEnabled: mf.enabled,
    });

    const dt = Date.now() - t0;

    const meta = {
      provider: "openai",
      build: BUILD_TAG,
      mode: aiMode,
      examDay,
      examStage,
      tag2Style,
      phase,
      tipAsked: Boolean(userAskedTip),
      blocked: blockedState,
      fallbackUsed: usedFallback,
      model,
      ms: dt,
      streaming: wantStream,
      assessment: parsed?.assessment ?? null,
      investigations: { performed: sessionState?.performedInv ?? [], newlyPerformed },
    };

    if (wantStream) return sseStreamText(req, res, String(text).trim(), meta);
    return res.json({ text: String(text).trim(), meta });
  } catch (e) {
    console.error("[examiner-turn] error:", e);

    const fallback = "Ich habe gerade ein technisches Problem.\nWas wäre Ihr nächster klinischer Schritt (Priorität) – und warum?";
    return res.status(200).json({
      text: fallback,
      meta: {
        fallbackUsed: true,
        error: true,
        build: BUILD_TAG,
        assessment: {
          verdict: "unclear",
          confidence: 0.2,
          depth: "surface",
          missing_critical: [],
          errors: ["Technischer Fehler – Bewertung nicht möglich."],
        },
      },
    });
  }
}

app.post("/api/examiner-turn", handleExaminerTurn);
app.post("/api/examinerTurn", handleExaminerTurn);
app.post("/api/chat", handleExaminerTurn);
app.post("/api/simulate", handleExaminerTurn);

// ---- 404 ----
app.use((req, res) => {
  return res.status(404).json({
    error: "Not found",
    method: req.method,
    path: req.path,
    hint: "Try /health, /api/examiner-turn, /api/generate-case, /api/transcribe, /api/stt, /api/realtime-token.",
  });
});

// ---- Global error ----
app.use((err, _req, res, _next) => {
  console.error("[express] unhandled error:", err);
  res.status(500).json({ error: "Server crashed", detail: String(err?.message ?? err) });
});

app.listen(PORT, HOST, () => {
  console.log(`ExamEcho server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠️  OPENAI_API_KEY is NOT set. /api/* calls will fail until you set it.");
  }
  if (!hasGoogleCredentialsConfigured()) {
    console.log("ℹ️  Google STT: GOOGLE_APPLICATION_CREDENTIALS not set. /api/stt will fallback to OpenAI.");
  }
  if (!getGcpProjectId()) {
    console.log("ℹ️  Google STT: GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT not set. /api/stt will fallback to OpenAI.");
  }
});
