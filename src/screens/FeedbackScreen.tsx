// src/screens/FeedbackScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";

import { colors } from "../theme/colors";
import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { VButton } from "../components/VButton";

import { ChatMessage, SessionConfig } from "../types";
import { getCaseById, CaseTemplate } from "../logic/cases";
import { computeFeedback } from "../logic/feedbackEngine";
import { saveSession } from "../logic/sessionStore";
import { saveDrills } from "../logic/drillStore";
import { markDrillDoneToday } from "../logic/planStore";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { fetchAiFeedbackReport, AiFeedbackReport } from "../logic/aiFeedback";
import { getAiBaseUrl, pingServerHealth } from "../logic/appSettings";

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function StatPill({ label, value }: { label: string; value: string }) {
  const { tokens } = useSectionTheme();
  return (
    <View style={[styles.statPill, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.1) }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.h2}>{title}</Text>
      {subtitle ? <Text style={styles.smallHint}>{subtitle}</Text> : null}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return <Text style={styles.muted}>—</Text>;
  return (
    <View style={{ marginTop: 6 }}>
      {items.map((t, i) => (
        <Text key={`${t}-${i}`} style={styles.itemText}>
          • {t}
        </Text>
      ))}
    </View>
  );
}

function prettyAiError(msg: string) {
  const s = String(msg ?? "");
  if (!s) return "";
  if (s.toLowerCase().includes("keine server-url")) {
    return "Keine Server-URL gesetzt. Öffne Home → Server testen / Settings und trage deine URL ein.";
  }
  if (s.toLowerCase().includes("timeout")) {
    return "Timeout: Server antwortet nicht. Prüfe WLAN / Mac-IP / Firewall und teste /health.";
  }
  return s;
}

function isPlaceholderUrl(url: string) {
  const s = String(url ?? "").trim();
  if (!s) return true;
  if (s.includes("DEINE_MAC_IP")) return true;
  return false;
}

function normalizeTags(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  const out = arr
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const t of out) {
    if (!seen.has(t)) {
      seen.add(t);
      uniq.push(t);
    }
  }
  return uniq.slice(0, 30);
}

type AiMode = "checking" | "ai" | "off";

export function FeedbackScreen({ route, navigation }: any) {
  const { tokens } = useSectionTheme();

  const cfg: SessionConfig | undefined = route?.params?.cfg;
  const messages: ChatMessage[] = route?.params?.messages ?? [];
  const caseId: string | undefined = route?.params?.caseId;

  const theCase: CaseTemplate | null = useMemo(() => {
    if (!caseId) return null;
    return (getCaseById(caseId) as any) ?? null;
  }, [caseId]);

  // Rule-based summary
  const summary: any = useMemo(() => computeFeedback(theCase as any, messages), [theCase, messages]);

  // Drill records from rule-based engine
  const drillRecords = useMemo(() => {
    const arr = (summary?.drills ?? []) as Array<{ title: string; why: string }>;
    return arr.map((d) => ({
      id: makeId(),
      createdAt: Date.now(),
      fachrichtung: cfg?.fachrichtung ?? "Unbekannt",
      caseId,
      title: d.title,
      why: d.why,
      doneCount: 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, caseId, cfg?.fachrichtung]);

  const missingItems = useMemo(() => {
    const fromEngine =
      (summary?.missingItems as Array<any> | undefined) ??
      (summary?.missing as Array<any> | undefined) ??
      null;

    if (Array.isArray(fromEngine) && fromEngine.length) return fromEngine;

    const fix = (summary?.fix3 ?? []) as Array<any>;
    return fix.map((x) => ({ label: x?.label ?? String(x), example: x?.example ?? "" }));
  }, [summary]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const it of missingItems) {
      const key = String(it?.label ?? it);
      next[key] = false;
    }
    setChecked(next);
  }, [missingItems]);

  // Save session once
  const sessionIdRef = useRef<string>(makeId());
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    if (!cfg) return;

    savedRef.current = true;

    // ✅ rule-based Progress-Tags
    const missingTags = normalizeTags((missingItems ?? []).map((it: any) => String(it?.label ?? it)));
    const drillTitles = normalizeTags((drillRecords ?? []).map((d: any) => String(d?.title ?? "")));

    saveSession({
      id: sessionIdRef.current,
      ts: Date.now(),
      fachrichtung: cfg.fachrichtung,
      tone: String(cfg.tone),
      difficulty: cfg.difficulty,
      mode: (cfg.mode ?? "text") as "text" | "voice",
      caseId,

      overallScore: summary?.overallScore ?? 0,
      matchedItems: summary?.matchedItems ?? 0,
      totalItems: summary?.totalItems ?? 0,

      phaseScores: {
        intro: summary?.phaseScores?.intro?.score ?? 0,
        ddx: summary?.phaseScores?.ddx?.score ?? 0,
        diagnostics: summary?.phaseScores?.diagnostics?.score ?? 0,
        management: summary?.phaseScores?.management?.score ?? 0,
        closing: summary?.phaseScores?.closing?.score ?? 0,
      },

      // ✅ NEW: für ProgressScreen
      missingTags,
      drillTitles,
    }).catch(() => {});

    if (drillRecords.length) {
      saveDrills(drillRecords as any).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, caseId, summary, drillRecords, missingItems]);

  // ✅ AI feedback
  const [aiMode, setAiMode] = useState<AiMode>("checking");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AiFeedbackReport | null>(null);
  const [aiError, setAiError] = useState<string>("");
  const [aiBaseUrl, setAiBaseUrl] = useState<string>("");

  const evaluateAiAvailability = async (): Promise<{ mode: AiMode; baseUrl: string; healthOk: boolean }> => {
    const b = await getAiBaseUrl();
    const baseUrl = String(b ?? "").trim();
    setAiBaseUrl(baseUrl);

    if (!baseUrl || isPlaceholderUrl(baseUrl)) {
      return { mode: "off", baseUrl, healthOk: false };
    }

    const ok = await pingServerHealth(baseUrl);
    return { mode: ok ? "ai" : "off", baseUrl, healthOk: ok };
  };

  const loadAi = async () => {
    if (!cfg) return;

    setAiLoading(true);
    setAiError("");
    setAiReport(null);

    try {
      setAiMode("checking");
      const avail = await evaluateAiAvailability();
      setAiMode(avail.mode);

      if (avail.mode !== "ai") {
        setAiLoading(false);
        setAiError(avail.baseUrl ? "Server nicht erreichbar oder ungültige URL." : "Keine Server-URL gesetzt.");
        return;
      }

      const rep = await fetchAiFeedbackReport({
        cfg,
        generatedCase: theCase,
        messages,
      });

      setAiReport(rep);
      setAiError("");
    } catch (e: any) {
      setAiError(String(e?.message ?? e));
      setAiReport(null);
      setAiMode("off");
    } finally {
      setAiLoading(false);
    }
  };

  // Autoload einmal
  useEffect(() => {
    if (!cfg) return;
    loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, theCase, messages]);

  // ✅ Wenn AI-Report da ist: Session updaten (merge dank sessionStore)
  useEffect(() => {
    if (!cfg) return;
    if (!aiReport) return;

    saveSession({
      id: sessionIdRef.current,
      fachrichtung: cfg.fachrichtung,

      aiScore: aiReport.overall?.score ?? 0,
      aiStrengths: normalizeTags(aiReport.top3_strengths ?? []),
      aiImprovements: normalizeTags(aiReport.top3_improvements ?? []),
      aiDangerousDdxMissing: normalizeTags(aiReport.medical?.dangerous_ddx_missing ?? []),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiReport, cfg]);

  const goHome = () => navigation.popToTop();
  const goTraining = () => navigation.navigate("Training");
  const goProgress = () => navigation.navigate("Progress");

  const toggleChecked = (label: string) => setChecked((prev) => ({ ...prev, [label]: !prev[label] }));

  const startDrill = async (drillId: string) => {
    try {
      await markDrillDoneToday();
    } catch {}
    navigation.navigate("DrillPlayer", { drillId, id: drillId });
  };

  const startBestDrill = () => {
    const first = drillRecords[0];
    if (!first?.id) return;
    startDrill(first.id);
  };

  const titleLine = cfg
    ? `${cfg.fachrichtung} • ${cfg.tone} • Schwierigkeit ${Math.round(cfg.difficulty)} • ${cfg.mode === "voice" ? "Mündlich" : "Schriftlich"}`
    : "Keine Sessiondaten";

  const primaryCtaTitle = drillRecords.length ? "1-Tap: Drill starten (2–3 min)" : "Training öffnen";
  const primaryCtaAction = drillRecords.length ? startBestDrill : goTraining;

  const aiSubtitle =
    aiMode === "checking"
      ? "Server-Check läuft…"
      : aiMode === "ai"
      ? "Server erreichbar → zusätzliches Abschlussfeedback."
      : "Server nicht gesetzt/erreichbar → KI-Coach aus.";

  return (
    <ThemedScreen section="simulation" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Feedback</Text>
            <Text style={styles.subtitle}>{titleLine}</Text>
          </View>
          <VButton title="Home" variant="ghost" onPress={goHome} style={styles.headerGhost} />
        </View>

        {/* Hero */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.overline}>Fall</Text>
            <Text style={styles.caseTitle} numberOfLines={2}>
              {theCase?.title ?? "Fall"}
            </Text>

            <View style={styles.statsRow}>
              <StatPill label="Score" value={`${summary?.overallScore ?? 0}%`} />
              <StatPill label="Treffer" value={`${summary?.matchedItems ?? 0}/${summary?.totalItems ?? 0}`} />
              <StatPill label="Mode" value={cfg?.mode === "voice" ? "Mündlich" : "Text"} />
            </View>

            <View style={styles.phaseRow}>
              <Chip text={`Einstieg ${summary?.phaseScores?.intro?.score ?? 0}%`} tone="muted" />
              <Chip text={`DDx ${summary?.phaseScores?.ddx?.score ?? 0}%`} tone="muted" />
              <Chip text={`Diagnostik ${summary?.phaseScores?.diagnostics?.score ?? 0}%`} tone="muted" />
              <Chip text={`Management ${summary?.phaseScores?.management?.score ?? 0}%`} tone="muted" />
              <Chip text={`Abschluss ${summary?.phaseScores?.closing?.score ?? 0}%`} tone="muted" />
            </View>

            <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
              <Text style={styles.smallHint}>Basis-Feedback (V1) basiert auf Pflichtpunkten/Keywords aus der Fall-Checkliste.</Text>
            </View>

            <View style={{ marginTop: 14 }}>
              <VButton title={primaryCtaTitle} variant="cta" onPress={primaryCtaAction} />
              <VButton title="Fortschritt" variant="outline" onPress={goProgress} style={{ marginTop: 10 }} />
            </View>
          </Card>
        </View>

        {/* Missing checklist */}
        <View style={styles.block}>
          <Card padding="lg">
            <SectionTitle title="☑️ Fehlende Pflichtpunkte" subtitle="Hake ab, was du beim nächsten Versuch sicher sagen willst." />

            {missingItems.length === 0 ? (
              <Text style={styles.muted}>Stark! Aktuell wurden keine fehlenden Pflichtpunkte erkannt.</Text>
            ) : (
              <View style={{ marginTop: 6 }}>
                {missingItems.map((it: any, idx: number) => {
                  const label = String(it?.label ?? it);
                  const example = String(it?.example ?? "");
                  const isOn = !!checked[label];

                  return (
                    <Pressable
                      key={`${label}-${idx}`}
                      onPress={() => toggleChecked(label)}
                      style={({ pressed }) => [
                        styles.checkRow,
                        {
                          borderColor: isOn ? rgba(tokens.tint, 0.22) : rgba(tokens.tint, 0.1),
                          backgroundColor: isOn ? rgba(tokens.tint, 0.1) : colors.surface,
                        },
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.checkDot,
                          {
                            borderColor: isOn ? rgba(tokens.tint, 0.32) : rgba(tokens.tint, 0.18),
                            backgroundColor: isOn ? rgba(tokens.tint, 0.18) : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.checkMark, { color: tokens.tint }]}>{isOn ? "✓" : ""}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemText}>{label}</Text>
                        {example ? <Text style={styles.example}>{example}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        </View>

        {/* ✅ AI COACH */}
        <View style={styles.block}>
          <Card padding="lg">
            <SectionTitle title="🤖 KI-Coach (prüfungsnah)" subtitle={aiSubtitle} />

            {aiLoading ? (
              <Text style={styles.muted}>KI-Feedback wird erstellt…</Text>
            ) : aiError ? (
              <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.05), borderColor: rgba(tokens.tint, 0.14) }]}>
                <Text style={styles.smallHint}>KI-Feedback nicht verfügbar. {prettyAiError(aiError)}</Text>
                {aiBaseUrl ? (
                  <Text style={[styles.smallHint, { marginTop: 6 }]} numberOfLines={2}>
                    Server: {aiBaseUrl}
                  </Text>
                ) : null}
                <VButton title="KI-Feedback erneut versuchen" variant="outline" onPress={loadAi} style={{ marginTop: 10 }} />
              </View>
            ) : aiMode !== "ai" ? (
              <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.05), borderColor: rgba(tokens.tint, 0.14) }]}>
                <Text style={styles.smallHint}>KI-Coach ist aus (Server nicht gesetzt/erreichbar).</Text>
                <VButton title="Erneut prüfen & laden" variant="outline" onPress={loadAi} style={{ marginTop: 10 }} />
              </View>
            ) : !aiReport ? (
              <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.05), borderColor: rgba(tokens.tint, 0.14) }]}>
                <Text style={styles.smallHint}>Noch kein KI-Report (oder leer).</Text>
                <VButton title="KI-Feedback holen" variant="outline" onPress={loadAi} style={{ marginTop: 10 }} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={[styles.aiBlock, { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.05) }]}>
                  <Text style={styles.aiTitle}>Gesamt</Text>
                  <Text style={styles.aiBig}>{aiReport.overall?.score ?? 0}%</Text>
                  <Text style={styles.aiText}>{aiReport.overall?.one_liner ?? ""}</Text>
                </View>

                <View>
                  <Text style={styles.aiTitle}>Medizin</Text>
                  <Text style={styles.aiSub}>Wahrscheinlichste Diagnose(n)</Text>
                  <BulletList items={aiReport.medical?.likely_dx ?? []} />

                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Gefährliche DDx, die fehlen</Text>
                  <BulletList items={aiReport.medical?.dangerous_ddx_missing ?? []} />

                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Nächste Diagnostik</Text>
                  <BulletList items={aiReport.medical?.diagnostics_next_best ?? []} />

                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Nächstes Management</Text>
                  <BulletList items={aiReport.medical?.management_next_best ?? []} />

                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Red Flags</Text>
                  <BulletList items={aiReport.medical?.red_flags ?? []} />
                </View>

                <View>
                  <Text style={styles.aiTitle}>Kommunikation</Text>
                  <View style={styles.statsRow}>
                    <StatPill label="Struktur" value={`${aiReport.communication?.structure?.score ?? 0}%`} />
                    <StatPill label="Priorität" value={`${aiReport.communication?.prioritization?.score ?? 0}%`} />
                    <StatPill label="Klarheit" value={`${aiReport.communication?.clarity?.score ?? 0}%`} />
                    <StatPill label="Empathie" value={`${aiReport.communication?.empathy?.score ?? 0}%`} />
                  </View>

                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Notizen</Text>
                  <Text style={styles.aiText}>• {aiReport.communication?.structure?.note ?? "—"}</Text>
                  <Text style={styles.aiText}>• {aiReport.communication?.prioritization?.note ?? "—"}</Text>
                  <Text style={styles.aiText}>• {aiReport.communication?.clarity?.note ?? "—"}</Text>
                  <Text style={styles.aiText}>• {aiReport.communication?.empathy?.note ?? "—"}</Text>
                </View>

                <View>
                  <Text style={styles.aiTitle}>Top 3</Text>
                  <Text style={styles.aiSub}>Stärken</Text>
                  <BulletList items={aiReport.top3_strengths ?? []} />
                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Verbesserungen</Text>
                  <BulletList items={aiReport.top3_improvements ?? []} />
                </View>

                <View>
                  <Text style={styles.aiTitle}>Nächstes Mal so sagen</Text>
                  <Text style={styles.aiSub}>Einstieg</Text>
                  <Text style={styles.aiText}>{aiReport.next_time_script?.opening ?? "—"}</Text>
                  <Text style={[styles.aiSub, { marginTop: 10 }]}>DDx</Text>
                  <Text style={styles.aiText}>{aiReport.next_time_script?.ddx ?? "—"}</Text>
                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Diagnostik</Text>
                  <Text style={styles.aiText}>{aiReport.next_time_script?.diagnostics ?? "—"}</Text>
                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Management</Text>
                  <Text style={styles.aiText}>{aiReport.next_time_script?.management ?? "—"}</Text>
                  <Text style={[styles.aiSub, { marginTop: 10 }]}>Abschluss</Text>
                  <Text style={styles.aiText}>{aiReport.next_time_script?.closing ?? "—"}</Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Drills */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>🧠 Drills</Text>
              {drillRecords.length ? (
                <VButton title="Alle ansehen →" variant="ghost" onPress={goTraining} style={styles.inlineGhost} />
              ) : null}
            </View>

            {drillRecords.length === 0 ? (
              <Text style={styles.muted}>Noch keine Drills generiert (oder keine Checkliste im Fall).</Text>
            ) : (
              drillRecords.map((d, idx) => (
                <View key={d.id} style={{ marginTop: idx === 0 ? 8 : 14 }}>
                  <Text style={styles.drillTitle}>{d.title}</Text>
                  <Text style={styles.muted}>{d.why}</Text>

                  <VButton
                    title={idx === 0 ? "Drill jetzt starten" : "Drill starten"}
                    variant={idx === 0 ? "cta" : "outline"}
                    onPress={() => startDrill(d.id)}
                    style={{ marginTop: 10 }}
                  />
                </View>
              ))
            )}
          </Card>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <VButton title="Neue Simulation" variant="outline" onPress={goHome} />
          <VButton title="Training öffnen" variant="ghost" onPress={goTraining} style={{ marginTop: 8 }} />
          <VButton title="Fortschritt" variant="ghost" onPress={goProgress} style={{ marginTop: 6 }} />
        </View>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 56 },

  header: { flexDirection: "row", gap: 12, alignItems: "flex-end", marginBottom: 6 },
  headerGhost: { paddingHorizontal: 4 },

  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  block: { marginTop: 12 },

  overline: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  caseTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 },

  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },
  statPill: { borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, minWidth: 100, flexGrow: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted, marginTop: 2 },

  phaseRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },

  note: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  muted: { color: colors.textMuted, lineHeight: 18, fontWeight: "800", marginTop: 6 },

  itemText: { color: colors.text, lineHeight: 20, fontWeight: "800" },
  example: { color: colors.textMuted, lineHeight: 18, marginTop: 4, fontWeight: "700" },

  checkRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 10,
  },
  checkDot: { width: 26, height: 26, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkMark: { fontWeight: "900" },

  drillTitle: { color: colors.text, fontWeight: "900" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  inlineGhost: { paddingHorizontal: 0 },

  actions: { marginTop: 14 },

  aiBlock: { borderWidth: 1, borderRadius: 16, padding: 12 },
  aiTitle: { fontWeight: "900", color: colors.text, fontSize: 14 },
  aiSub: { fontWeight: "900", color: colors.textMuted, marginTop: 6, fontSize: 12 },
  aiBig: { fontWeight: "900", color: colors.text, fontSize: 22, marginTop: 4 },
  aiText: { color: colors.textMuted, lineHeight: 18, fontWeight: "800", marginTop: 4 },
});
