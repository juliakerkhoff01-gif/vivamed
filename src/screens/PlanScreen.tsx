import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TextInput, Alert, Pressable } from "react-native";
import Slider from "@react-native-community/slider";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";
import { SelectField } from "../components/SelectField";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { getCaseById } from "../logic/cases";
import { loadSessions, StoredSession } from "../logic/sessionStore";
import {
  computeDaysLeft,
  getOrCreateTodayPlan,
  isDrillDoneToday,
  loadPlanSettings,
  markDrillDoneToday,
  parseISODateToMs,
  savePlanSettings,
  clearTodayPlan,
} from "../logic/planStore";

import { FACHRICHTUNGEN_WITH_EMPTY } from "../logic/fachrichtungen";
import { INNERE_SUBFAECHER } from "../logic/innereSubfaecher";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function PlanScreen({ navigation, route }: any) {
  const { tokens } = useSectionTheme();
  const passedCfg = route?.params?.cfg ?? null;

  const fallbackCfg = useMemo(
    () => ({
      fachrichtung: "Innere Medizin",
      tone: "neutral",
      difficulty: 65,
      mode: "text",
      examinerProfile: "standard",
      innereSubfach: "all",
    }),
    []
  );

  const baseCfg = passedCfg ?? fallbackCfg;
  const fachrichtungen = useMemo(() => FACHRICHTUNGEN_WITH_EMPTY, []);

  const [settings, setSettings] = useState<any>(null);
  const [isoInput, setIsoInput] = useState<string>("");

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [drillDone, setDrillDone] = useState<boolean>(false);

  const [wahlInnereOpen, setWahlInnereOpen] = useState(false);
  const [losInnereOpen, setLosInnereOpen] = useState(false);

  const refresh = async () => {
    const s = await loadPlanSettings();
    setSettings(s);

    if (typeof s?.examDateMs === "number") {
      const d = new Date(s.examDateMs);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setIsoInput(`${y}-${m}-${day}`);
    } else {
      setIsoInput("");
    }

    const sess = await loadSessions();
    setSessions(sess);

    // ✅ FIX: getOrCreateTodayPlan erwartet bei dir offenbar KEIN "cases:"
    const plan = await getOrCreateTodayPlan({
      cfg: baseCfg,
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

  const daysLeft = useMemo(() => computeDaysLeft(settings?.examDateMs ?? null), [settings?.examDateMs]);

  const todayCaseDone = useMemo(() => {
    if (!todayPlan?.caseId) return false;
    const start = startOfDay(Date.now());
    const end = start + 24 * 60 * 60 * 1000;
    return sessions.some((s: any) => s?.caseId === todayPlan.caseId && (s?.ts ?? 0) >= start && (s?.ts ?? 0) < end);
  }, [sessions, todayPlan?.caseId]);

  const todayCaseTitle = useMemo(() => {
    if (!todayPlan?.caseId) return "—";
    const c = getCaseById(todayPlan.caseId);
    return c?.title ?? `Fall: ${todayPlan.caseId}`;
  }, [todayPlan?.caseId]);

  const generalprobeMode = useMemo(() => {
    if (daysLeft === null) return false;
    return daysLeft <= 7 && daysLeft >= 0;
  }, [daysLeft]);

  const onSaveExamDate = async () => {
    if (!settings) return;

    const ms = parseISODateToMs(isoInput);
    if (!ms) {
      Alert.alert("Format prüfen", "Bitte im Format YYYY-MM-DD eingeben (z.B. 2026-03-15).");
      return;
    }

    const next = { ...settings, examDateMs: ms };
    await savePlanSettings(next as any);
    setSettings(next);
    Alert.alert("Gespeichert", "Prüfungsdatum wurde gespeichert.");
  };

  const onClearExamDate = async () => {
    if (!settings) return;
    const next = { ...settings, examDateMs: null };
    await savePlanSettings(next as any);
    setSettings(next);
    Alert.alert("Zurückgesetzt", "Prüfungsdatum wurde entfernt.");
  };

  const onSaveSettings = async (patch: any) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    await savePlanSettings(next as any);
    setSettings(next);
  };

  const onStartTodayCase = () => {
    if (!todayPlan?.caseId) return;

    const adaptiveCfg = {
      ...baseCfg,
      fachrichtung: todayPlan.fachrichtung,
      caseId: todayPlan.caseId,
      examinerProfile: todayPlan.suggestedExaminerProfile ?? baseCfg.examinerProfile,
      difficulty: typeof todayPlan.suggestedDifficulty === "number" ? todayPlan.suggestedDifficulty : baseCfg.difficulty,
    };

    navigation.navigate("Simulation" as never, { cfg: adaptiveCfg } as never);
  };

  const onOpenDrill = async () => {
    await markDrillDoneToday();
    setDrillDone(true);
    navigation.navigate("Training" as never);
  };

  const onRerollToday = async () => {
    await clearTodayPlan();

    // ✅ FIX: auch hier kein "cases:"
    const plan = await getOrCreateTodayPlan({
      cfg: baseCfg,
      sessions: sessions as any,
    });
    setTodayPlan(plan);
  };

  // ✅ Settings-Screen öffnen (neu)
  const onOpenSettings = () => {
    navigation.navigate("Settings" as never);
  };

  const wahlfachIsInnere = (settings?.wahlfach ?? "") === "Innere Medizin";
  const losfachIsInnere = (settings?.losfach ?? "") === "Innere Medizin";

  return (
    <ThemedScreen section="plan" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Plan</Text>
            <Text style={styles.subtitle}>Adaptiv nach Performance → heute: 1 Fall + 1 Drill</Text>
          </View>

          <VButton title="Einstellungen" variant="ghost" onPress={onOpenSettings} style={styles.headerGhost} />
          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* Exam date */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Prüfungsdatum</Text>

            <View style={styles.chips}>
              <Chip text={daysLeft === null ? "Datum: nicht gesetzt" : `Noch ${daysLeft} Tage`} tone="soft" />
              <Chip text={`Tage/Woche: ${settings?.daysPerWeek ?? 5}`} tone="soft" />
              {generalprobeMode ? <Chip text="Generalprobe-Woche" selected tone="soft" /> : null}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Datum (YYYY-MM-DD)</Text>
            <TextInput
              value={isoInput}
              onChangeText={setIsoInput}
              placeholder="2026-03-15"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.06) }]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <VButton title="Datum speichern" variant="cta" onPress={onSaveExamDate} style={{ marginTop: 14 }} />
            <VButton title="Datum entfernen" variant="outline" onPress={onClearExamDate} style={{ marginTop: 10 }} />
          </Card>
        </View>

        {/* Settings */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Einstellungen</Text>

            <SelectField
              label="Wahlfach (optional)"
              value={settings?.wahlfach ?? ""}
              onChange={(v) => {
                const chosen = v ? String(v) : "";
                onSaveSettings({
                  wahlfach: chosen ? chosen : null,
                  wahlfachInnereSubfach: chosen === "Innere Medizin" ? settings?.wahlfachInnereSubfach ?? "" : "",
                });
                if (chosen !== "Innere Medizin") setWahlInnereOpen(false);
              }}
              items={fachrichtungen}
            />

            {wahlfachIsInnere ? (
              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => setWahlInnereOpen((o) => !o)}
                  style={[styles.collHeader, { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.06) }]}
                >
                  <Text style={styles.collTitle}>Innere-Unterfächer (Wahlfach)</Text>
                  <Text style={styles.collChevron}>{wahlInnereOpen ? "▲" : "▼"}</Text>
                </Pressable>

                {wahlInnereOpen ? (
                  <View style={{ marginTop: 10 }}>
                    <SelectField
                      label="Unterfach (optional)"
                      value={settings?.wahlfachInnereSubfach ?? ""}
                      onChange={(v) => onSaveSettings({ wahlfachInnereSubfach: String(v ?? "") })}
                      items={INNERE_SUBFAECHER}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <SelectField
              label="Losfach (optional)"
              value={settings?.losfach ?? ""}
              onChange={(v) => {
                const chosen = v ? String(v) : "";
                onSaveSettings({
                  losfach: chosen ? chosen : null,
                  losfachInnereSubfach: chosen === "Innere Medizin" ? settings?.losfachInnereSubfach ?? "" : "",
                });
                if (chosen !== "Innere Medizin") setLosInnereOpen(false);
              }}
              items={fachrichtungen}
            />

            {losfachIsInnere ? (
              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => setLosInnereOpen((o) => !o)}
                  style={[styles.collHeader, { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.06) }]}
                >
                  <Text style={styles.collTitle}>Innere-Unterfächer (Losfach)</Text>
                  <Text style={styles.collChevron}>{losInnereOpen ? "▲" : "▼"}</Text>
                </Pressable>

                {losInnereOpen ? (
                  <View style={{ marginTop: 10 }}>
                    <SelectField
                      label="Unterfach (optional)"
                      value={settings?.losfachInnereSubfach ?? ""}
                      onChange={(v) => onSaveSettings({ losfachInnereSubfach: String(v ?? "") })}
                      items={INNERE_SUBFAECHER}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>Verfügbare Tage/Woche: {settings?.daysPerWeek ?? 5}</Text>
            <View style={[styles.sliderWrap, { borderColor: rgba(tokens.tint, 0.14), backgroundColor: rgba(tokens.tint, 0.06) }]}>
              <Slider
                minimumValue={1}
                maximumValue={7}
                step={1}
                value={settings?.daysPerWeek ?? 5}
                onValueChange={(v) => onSaveSettings({ daysPerWeek: Number(v) })}
                minimumTrackTintColor={(colors as any).primary ?? tokens.tint}
                maximumTrackTintColor={rgba(tokens.tint, 0.14)}
                thumbTintColor={(colors as any).primary ?? tokens.tint}
              />
            </View>

            <View style={[styles.softPanel, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
              <Text style={styles.helper}>
                V1-Regel: Pro Lerntag → <Text style={styles.strong}>1 Fall + 1 Drill</Text>. Auswahl priorisiert deinen
                schwächsten Skill.
              </Text>
            </View>
          </Card>
        </View>

        {/* Today */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Heute</Text>

            <View style={styles.chips}>
              <Chip text={`${todayCaseDone ? "✓" : "○"} Fall`} selected={todayCaseDone} tone="soft" />
              <Chip text={`${drillDone ? "✓" : "○"} Drill`} selected={drillDone} tone="soft" />
              {todayPlan?.focusSkill ? <Chip text={`Fokus: ${todayPlan.focusSkill}`} tone="soft" /> : null}
              {todayPlan?.suggestedExaminerProfile ? <Chip text={`Profil: ${todayPlan.suggestedExaminerProfile}`} tone="soft" /> : null}
              {typeof todayPlan?.suggestedDifficulty === "number" ? (
                <Chip text={`Diff: ${Math.round(todayPlan.suggestedDifficulty)}`} tone="soft" />
              ) : null}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Empfohlener Fall</Text>
            <Text style={styles.big} numberOfLines={2}>
              {todayCaseTitle}
            </Text>

            <VButton
              title={todayCaseDone ? "Fall nochmal starten" : "Fall starten (adaptiv)"}
              variant="cta"
              onPress={onStartTodayCase}
              style={{ marginTop: 14 }}
            />
            <VButton
              title={drillDone ? "Drill öffnen (bereits erledigt)" : "Drill öffnen (1–3 min)"}
              variant="outline"
              onPress={onOpenDrill}
              style={{ marginTop: 10 }}
            />
            <VButton title="Heute neu würfeln" variant="ghost" onPress={onRerollToday} style={{ marginTop: 8 }} />
          </Card>
        </View>

        {/* Generalprobe */}
        {generalprobeMode ? (
          <View style={styles.block}>
            <Card accent padding="lg">
              <Text style={styles.h2}>Generalprobe-Woche</Text>
              <Text style={styles.muted}>V1: 2–3 Strict-Mode Sessions + 1 Examenssimulation.</Text>

              <VButton
                title="Examenssimulation öffnen"
                variant="cta"
                onPress={() => navigation.navigate("Exam" as never, { cfg: { ...baseCfg, difficulty: 85 } } as never)}
                style={{ marginTop: 14 }}
              />

              <VButton
                title="Strict-Session starten"
                variant="outline"
                onPress={() => navigation.navigate("Simulation" as never, { cfg: { ...baseCfg, difficulty: 90 } } as never)}
                style={{ marginTop: 10 }}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 56 },

  header: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginBottom: 6 },
  headerGhost: { paddingHorizontal: 4 },

  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  block: { marginTop: 12 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  chips: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },

  label: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginTop: 6, marginBottom: 6 },

  helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  strong: { color: colors.text, fontWeight: "900" },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontWeight: "700",
  },

  sliderWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },

  big: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 2 },

  muted: { color: colors.textMuted, lineHeight: 18, fontWeight: "800", marginTop: 6 },

  softPanel: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },

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
});
