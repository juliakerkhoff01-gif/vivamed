import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";
import { SelectField } from "../components/SelectField";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import {
  loadAppSettings,
  pingServerHealth,
  getAiBaseUrl,
  canStartSimulation,
  markDemoSimulationUsed,
  canOpenTraining,
  markDemoDrillUsed,
} from "../logic/appSettings";

import { loadSessions, StoredSession } from "../logic/sessionStore";
import { getOrCreateTodayPlan, isDrillDoneToday, markDrillDoneToday, clearTodayPlan } from "../logic/planStore";

import { FACHRICHTUNGEN } from "../logic/fachrichtungen";
import { INNERE_SUBFAECHER } from "../logic/innereSubfaecher";
import { getCaseById } from "../logic/cases";

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isPlaceholderUrl(url: string) {
  const s = String(url ?? "").trim();
  if (!s) return true;
  if (s.includes("DEINE_MAC_IP")) return true;
  return false;
}

// kleine Helper: liest Demo-Limits (kompatibel mit alt+neu)
function getDemoMetaFromSettings(s: any) {
  const isPro = !!s?.isPro;

  // ✅ NEU (optional): demoSimUsedCount + demoSimLimit
  const demoSimLimit =
    Number.isFinite(Number(s?.demoSimLimit)) && Number(s?.demoSimLimit) > 0 ? Number(s?.demoSimLimit) : null;

  const demoSimUsedCount =
    Number.isFinite(Number(s?.demoSimUsedCount)) && Number(s?.demoSimUsedCount) >= 0
      ? Number(s?.demoSimUsedCount)
      : null;

  // ✅ ALT (fallback): demoSimUsed boolean => Limit 1
  const legacyDemoSimUsed = !!s?.demoSimUsed;

  const simLimit = demoSimLimit ?? 1;
  const simUsed = demoSimUsedCount ?? (legacyDemoSimUsed ? 1 : 0);
  const simLeft = Math.max(0, simLimit - simUsed);

  // Drill demo: boolean (wie bisher)
  const drillUsed = !!s?.demoDrillUsed;
  const drillLeft = drillUsed ? 0 : 1;

  return { isPro, simLimit, simUsed, simLeft, drillLeft };
}

export function HomeScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();
  const fachrichtungen = useMemo(() => FACHRICHTUNGEN, []);
  const nav = navigation as any;

  const [cfg, setCfg] = useState<any>({
    fachrichtung: "Innere Medizin",
    innereSubfach: "all",
    tone: "neutral",
    difficulty: 65,
    mode: "text",
    examinerProfile: "standard",
  });

  const [innereOpen, setInnereOpen] = useState(false);

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [drillDone, setDrillDone] = useState(false);

  // Server Status
  const [serverBaseUrl, setServerBaseUrl] = useState<string>("");
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  // Monetization UI
  const [isPro, setIsPro] = useState(false);
  const [simLeft, setSimLeft] = useState<number>(0);
  const [simLimit, setSimLimit] = useState<number>(1);
  const [drillLeft, setDrillLeft] = useState<number>(1);

  const refresh = async () => {
    let nextCfg = { ...cfg };

    try {
      const s = await loadAppSettings();

      const preferredF = (s?.preferredFachrichtung ?? "Innere Medizin").trim() || "Innere Medizin";
      const preferredSub = (s?.preferredInnereSubfach ?? "").trim();

      nextCfg = {
        ...nextCfg,
        fachrichtung: preferredF,
        innereSubfach: preferredF === "Innere Medizin" ? (preferredSub.length ? preferredSub : "all") : "all",
        mode: s?.preferredMode ?? nextCfg.mode ?? "text",
      };

      // Monetization meta
      const meta = getDemoMetaFromSettings(s);
      setIsPro(meta.isPro);
      setSimLimit(meta.simLimit);
      setSimLeft(meta.simLeft);
      setDrillLeft(meta.drillLeft);

      // Server URL (einzige Quelle: appSettings)
      const b = await getAiBaseUrl();
      setServerBaseUrl(b);
      setServerOk(null);
    } catch {
      setServerBaseUrl("");
      setServerOk(null);
      setIsPro(false);
      setSimLimit(1);
      setSimLeft(0);
      setDrillLeft(0);
    }

    setCfg(nextCfg);

    const sess = await loadSessions();
    setSessions(sess);

    const plan = await getOrCreateTodayPlan({
      cfg: { ...nextCfg },
      sessions: sess as any,
    });
    setTodayPlan(plan);

    const done = await isDrillDoneToday();
    setDrillDone(done);
  };

  useEffect(() => {
    const unsub = navigation.addListener("focus", refresh);
    refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  useEffect(() => {
    if (cfg?.fachrichtung !== "Innere Medizin") {
      setInnereOpen(false);
      setCfg((p: any) => ({ ...p, innereSubfach: "all" }));
    }
  }, [cfg?.fachrichtung]);

  const todayCaseTitle = useMemo(() => {
    if (!todayPlan?.caseId) return "—";
    const gen = todayPlan?.generatedCase;
    if (gen?.title) return gen.title;
    const c = getCaseById(todayPlan.caseId);
    return c?.title ?? `Fall: ${todayPlan.caseId}`;
  }, [todayPlan?.caseId, todayPlan?.generatedCase]);

  const lastSessionInfo = useMemo(() => {
    const last = sessions?.[0];
    if (!last) return "—";
    const d = new Date(last.ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} • ${last.fachrichtung}`;
  }, [sessions]);

  const openPaywall = (reason: string) => {
    nav.navigate("Paywall", { reason });
  };

  const onStartTodayCase = async () => {
    if (!todayPlan?.caseId) return;

    const gate = await canStartSimulation();
    if (!gate.ok) {
      Alert.alert("Pro erforderlich", gate.reason ?? "Für weitere Simulationen brauchst du Pro.", [
        { text: "Pro holen", onPress: () => openPaywall("Simulationen") },
        { text: "Abbrechen", style: "cancel" },
      ]);
      return;
    }

    await markDemoSimulationUsed();

    const adaptiveCfg = {
      ...cfg,
      fachrichtung: todayPlan.fachrichtung ?? cfg.fachrichtung,
      innereSubfach: todayPlan.innereSubfach ?? cfg.innereSubfach,
      caseId: todayPlan.caseId,
      examinerProfile: todayPlan.suggestedExaminerProfile ?? cfg.examinerProfile,
      difficulty: typeof todayPlan.suggestedDifficulty === "number" ? todayPlan.suggestedDifficulty : cfg.difficulty,
    };

    if (todayPlan?.generatedCase?.id) {
      nav.navigate("Simulation", { cfg: adaptiveCfg, generatedCase: todayPlan.generatedCase });
      return;
    }
    nav.navigate("Simulation", { cfg: adaptiveCfg });
  };

  const onOpenDrill = async () => {
    const gate = await canOpenTraining();
    if (!gate.ok) {
      Alert.alert("Pro erforderlich", gate.reason ?? "Für Drills brauchst du Pro.", [
        { text: "Pro holen", onPress: () => openPaywall("Drills") },
        { text: "Abbrechen", style: "cancel" },
      ]);
      return;
    }

    await markDemoDrillUsed();

    await markDrillDoneToday();
    setDrillDone(true);
    nav.navigate("Training");
  };

  const onOpenPlan = () => nav.navigate("Plan", { cfg });
  const onOpenSettings = () => nav.navigate("Settings");
  const onOpenProgress = () => nav.navigate("Progress");


  const onRerollToday = async () => {
    await clearTodayPlan();
    const plan = await getOrCreateTodayPlan({ cfg, sessions: sessions as any });
    setTodayPlan(plan);
  };

  const onTestServer = async () => {
    const url = serverBaseUrl;
    if (!url || isPlaceholderUrl(url)) {
      setServerOk(false);
      return;
    }
    setServerOk(null);
    const ok = await pingServerHealth(url);
    setServerOk(ok);
  };

  const difficultyLabel =
    cfg.difficulty >= 85 ? "Sehr hoch" : cfg.difficulty >= 70 ? "Hoch" : cfg.difficulty >= 45 ? "Mittel" : "Niedrig";

  const subtitle = isPro
    ? "Pro: unbegrenzt • alle Drills & volles Feedback"
    : simLimit === 1
    ? `Demo: 1 Simulation + ${drillLeft ? "1 Drill" : "0 Drills"} • Pro: unbegrenzt`
    : `Demo: ${simLeft}/${simLimit} Simulationen übrig + ${drillLeft ? "1 Drill" : "0 Drills"} • Pro: unbegrenzt`;

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>VivaMed</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {/* ✅ SETTINGS: größer, klar als Zahnrad (ohne Header-Höhe zu ändern) */}
            <Pressable
              onPress={onOpenSettings}
              hitSlop={10}
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  borderColor: rgba(tokens.tint, 0.18),
                  backgroundColor: rgba(tokens.tint, 0.06),
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Einstellungen"
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </Pressable>

            <VButton title="Plan" variant="ghost" onPress={onOpenPlan} style={styles.headerGhost} />
          </View>
        </View>

        {/* Status */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Status</Text>
            <View style={styles.chips}>
              <Chip text={`Letzte Session: ${lastSessionInfo}`} tone="soft" />
              {todayPlan?.focusSkill ? <Chip text={`Fokus: ${todayPlan.focusSkill}`} tone="soft" /> : null}
              {typeof todayPlan?.suggestedDifficulty === "number" ? (
                <Chip text={`Diff: ${Math.round(todayPlan.suggestedDifficulty)}`} tone="soft" />
              ) : (
                <Chip text={`Diff: ${Math.round(cfg.difficulty)} (${difficultyLabel})`} tone="soft" />
              )}
              {drillDone ? <Chip text="✓ Drill erledigt" selected tone="soft" /> : <Chip text="○ Drill offen" tone="soft" />}

              <Chip
                text={
                  isPro
                    ? "Pro aktiv"
                    : simLimit === 1
                    ? simLeft
                      ? "Demo: 1 Sim übrig"
                      : "Demo: 0 Sim übrig"
                    : `Demo: ${simLeft}/${simLimit} Sims`
                }
                tone="soft"
              />

              {serverBaseUrl && !isPlaceholderUrl(serverBaseUrl) ? (
                <Chip
                  text={
                    serverOk === null
                      ? `Server: ? (${serverBaseUrl})`
                      : serverOk
                      ? `Server: OK (${serverBaseUrl})`
                      : `Server: Fehler (${serverBaseUrl})`
                  }
                  tone="soft"
                />
              ) : (
                <Chip text="Server: keine URL gesetzt" tone="soft" />
              )}
            </View>

            <View style={{ marginTop: 10 }}>
              <VButton title="Server testen (/health)" variant="outline" onPress={onTestServer} />
              <Text style={styles.smallHint}>
                Tipp: Expo Go am iPhone → nutze deine Mac-IP (nicht localhost). Beispiel: http://192.168.x.x:8787
              </Text>
            </View>

            {!isPro ? (
              <View style={{ marginTop: 10 }}>
                <VButton title="Pro freischalten" variant="cta" onPress={() => openPaywall("Upgrade")} />
                <VButton title="Fortschritt ansehen" variant="outline" onPress={onOpenProgress} style={{ marginTop: 10 }} />
              </View>
            ) : null}
          </Card>
        </View>

        {/* Start-Einstellungen */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Start-Einstellungen</Text>

            <SelectField
              label="Fachrichtung"
              value={cfg.fachrichtung}
              onChange={(v) => setCfg((p: any) => ({ ...p, fachrichtung: String(v ?? "Innere Medizin") }))}
              items={fachrichtungen}
            />

            {cfg.fachrichtung === "Innere Medizin" ? (
              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => setInnereOpen((o) => !o)}
                  style={[
                    styles.collHeader,
                    { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.06) },
                  ]}
                >
                  <Text style={styles.collTitle}>Innere-Unterfach</Text>
                  <Text style={styles.collChevron}>{innereOpen ? "▲" : "▼"}</Text>
                </Pressable>

                {innereOpen ? (
                  <View style={{ marginTop: 10 }}>
                    <SelectField
                      label="Unterfach (optional)"
                      value={cfg.innereSubfach ?? "all"}
                      onChange={(v) => setCfg((p: any) => ({ ...p, innereSubfach: String(v ?? "all") }))}
                      items={INNERE_SUBFAECHER}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ marginTop: 10 }}>
              <SelectField
                label="Ton"
                value={cfg.tone}
                onChange={(v) => setCfg((p: any) => ({ ...p, tone: String(v ?? "neutral") }))}
                items={[
                  { label: "Freundlich", value: "freundlich" },
                  { label: "Neutral", value: "neutral" },
                  { label: "Streng", value: "streng" },
                ]}
              />

              <SelectField
                label="Modus"
                value={cfg.mode}
                onChange={(v) => setCfg((p: any) => ({ ...p, mode: String(v ?? "text") }))}
                items={[
                  { label: "Schriftlich", value: "text" },
                  { label: "Mündlich (Diktierfunktion)", value: "voice" },
                ]}
              />

              <SelectField
                label="Prüferprofil"
                value={cfg.examinerProfile}
                onChange={(v) => setCfg((p: any) => ({ ...p, examinerProfile: String(v ?? "standard") }))}
                items={[
                  { label: "Standard", value: "standard" },
                  { label: "Red Flags", value: "redflag" },
                  { label: "Guidelines", value: "guidelines" },
                  { label: "Kommunikation", value: "communication" },
                  { label: "Rapidfire", value: "rapidfire" },
                ]}
              />

              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldLabel}>Schwierigkeit</Text>

                <View style={styles.diffRow}>
                  <Pressable
                    onPress={() => setCfg((p: any) => ({ ...p, difficulty: clamp(Number(p.difficulty ?? 65) - 5, 0, 100) }))}
                    style={({ pressed }) => [
                      styles.diffBtn,
                      { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.06) },
                      pressed ? { opacity: 0.86 } : null,
                    ]}
                  >
                    <Text style={styles.diffBtnText}>−</Text>
                  </Pressable>

                  <View style={[styles.diffValueBox, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.06) }]}>
                    <Text style={styles.diffValue}>{Math.round(cfg.difficulty)}</Text>
                    <Text style={styles.diffHint}>{difficultyLabel}</Text>
                  </View>

                  <Pressable
                    onPress={() => setCfg((p: any) => ({ ...p, difficulty: clamp(Number(p.difficulty ?? 65) + 5, 0, 100) }))}
                    style={({ pressed }) => [
                      styles.diffBtn,
                      { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.06) },
                      pressed ? { opacity: 0.86 } : null,
                    ]}
                  >
                    <Text style={styles.diffBtnText}>+</Text>
                  </Pressable>
                </View>

                <Text style={styles.smallHint}>Niedrig = mehr Hilfe. Hoch = prüfungsnah.</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Heute */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Heute</Text>

            <Text style={styles.label}>Empfohlener Fall</Text>
            <Text style={styles.big} numberOfLines={2}>
              {todayCaseTitle}
            </Text>

            <VButton title="Fall starten" variant="cta" onPress={onStartTodayCase} style={{ marginTop: 14 }} />

            <VButton
              title={drillDone ? "Drill öffnen (bereits erledigt)" : "Drill öffnen"}
              variant="outline"
              onPress={onOpenDrill}
              style={{ marginTop: 10 }}
            />

            <VButton title="Heute neu würfeln" variant="ghost" onPress={onRerollToday} style={{ marginTop: 8 }} />
          </Card>
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

  // ✅ Settings Button (größer & klar)
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    // wichtig: kein extra marginBottom → Header-Höhe bleibt
  },
  settingsIcon: {
    fontSize: 22,
    // leicht nach oben ziehen, damit es optisch wie ein Icon wirkt (optional)
    marginTop: -1,
  },

  block: { marginTop: 12 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },

  label: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginTop: 6, marginBottom: 6 },
  big: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 2 },

  collHeader: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collTitle: { color: colors.text, fontWeight: "900" },
  collChevron: { color: colors.textMuted, fontWeight: "900" },

  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginTop: 10, marginBottom: 6 },

  diffRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  diffBtn: { width: 46, height: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  diffBtnText: { color: colors.text, fontWeight: "900", fontSize: 20 },
  diffValueBox: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  diffValue: { color: colors.text, fontWeight: "900", fontSize: 18 },
  diffHint: { color: colors.textMuted, fontWeight: "800", marginTop: 2, fontSize: 12 },

  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 8 },
});
