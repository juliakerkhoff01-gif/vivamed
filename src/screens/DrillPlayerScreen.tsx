import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { VButton } from "../components/VButton";
import { colors } from "../theme/colors";

import { Drill, loadDrills, markDrillDone as markDrillDoneInStore } from "../logic/drillStore";
import { getCaseById } from "../logic/cases";
import { markDrillDone as markDrillDoneForStreak } from "../logic/streaks";
import { markDrillDoneToday } from "../logic/planStore";
import { useSectionTheme } from "../theme/SectionThemeContext";
import { canOpenTraining, markDemoDrillUsed, loadAppSettings } from "../logic/appSettings";

function fmt(ts?: number) {
  if (!ts) return "–";
  try {
    return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  } catch {
    return String(ts);
  }
}

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${m}:${ss}`;
}

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function MetaPill({ label, value }: { label: string; value: string }) {
  const { tokens } = useSectionTheme();
  return (
    <View
      style={[
        styles.metaPill,
        { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.1) },
      ]}
    >
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

export function DrillPlayerScreen({ route, navigation }: any) {
  const { tokens } = useSectionTheme();
  const drillId: string | undefined = route?.params?.drillId;

  const [drill, setDrill] = useState<Drill | null>(null);

  const [duration, setDuration] = useState(60);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [running, setRunning] = useState(false);

  const tickRef = useRef<any>(null);

  // ✅ Gate (deep-link safe) – aber nur wenn drillId existiert
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const runGate = async () => {
      // Wenn kein Drill ausgewählt ist: kein Monetization-Gate nötig
      if (!drillId) {
        if (!cancelled) setGateReady(true);
        return;
      }

      try {
        const gate = await canOpenTraining();
        if (!gate.ok) {
          if (!cancelled) navigation.replace("Paywall", { reason: "Drills" });
          return;
        }

        // ✅ Demo nur “verbrauchen”, wenn nicht Pro (idempotent ist es sowieso)
        try {
          const s = await loadAppSettings();
          if (!s?.isPro) await markDemoDrillUsed();
        } catch {
          // fallback: trotzdem idempotent versuchen
          await markDemoDrillUsed();
        }
      } finally {
        if (!cancelled) setGateReady(true);
      }
    };

    runGate();
    return () => {
      cancelled = true;
    };
  }, [navigation, drillId]);

  // Drill laden
  const load = async () => {
    try {
      const all = await loadDrills();
      const found = all.find((d) => d.id === drillId) ?? null;
      setDrill(found);
    } catch {
      setDrill(null);
    }
  };

  useEffect(() => {
    if (!drillId) {
      setDrill(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId]);

  // Timer lifecycle
  useEffect(() => {
    if (!running) return;

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [running]);

  // Wenn 0 erreicht: stop
  useEffect(() => {
    if (secondsLeft === 0 && running) setRunning(false);
  }, [secondsLeft, running]);

  // Duration ändern: wenn nicht running, setze secondsLeft mit
  useEffect(() => {
    if (!running) setSecondsLeft(duration);
  }, [duration, running]);

  // Cleanup bei Unmount (sicher)
  useEffect(() => {
    return () => {
      try {
        if (tickRef.current) clearInterval(tickRef.current);
      } catch {}
      tickRef.current = null;
    };
  }, []);

  const caseTitle = useMemo(() => {
    if (!drill?.caseId) return null;
    const c = getCaseById(drill.caseId);
    return c?.title ?? null;
  }, [drill?.caseId]);

  const durationLabel = useMemo(() => {
    if (duration === 60) return "60s";
    return `${Math.round(duration / 60)} min`;
  }, [duration]);

  const progressPct = useMemo(() => {
    const d = Math.max(1, Number(duration));
    const left = Math.max(0, Math.min(d, Number(secondsLeft)));
    return Math.round(((d - left) / d) * 100);
  }, [duration, secondsLeft]);

  const startPause = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(duration);
  };

  const finish = async () => {
    if (!drill) return;

    try {
      await markDrillDoneInStore(drill.id);
    } catch {}

    try {
      await markDrillDoneForStreak();
    } catch {}

    try {
      await markDrillDoneToday();
    } catch {}

    navigation.goBack();
  };

  // ✅ während Gate läuft: nicht rendern (verhindert Flicker)
  if (!gateReady) {
    return (
      <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
        <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Prüfe Zugriff…</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "800" }}>Einen Moment.</Text>
        </View>
      </ThemedScreen>
    );
  }

  // States
  if (!drillId) {
    return (
      <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
        <View style={{ padding: 16 }}>
          <Card accent padding="lg">
            <Text style={styles.h1}>Drill</Text>
            <Text style={styles.muted}>Kein Drill ausgewählt.</Text>
            <VButton title="Zurück" variant="cta" onPress={() => navigation.goBack()} style={{ marginTop: 14 }} />
          </Card>
        </View>
      </ThemedScreen>
    );
  }

  if (!drill) {
    return (
      <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
        <View style={{ padding: 16 }}>
          <Card accent padding="lg">
            <Text style={styles.h1}>Drill</Text>
            <Text style={styles.muted}>Drill nicht gefunden (evtl. gelöscht).</Text>
            <VButton title="Zurück" variant="cta" onPress={() => navigation.goBack()} style={{ marginTop: 14 }} />
          </Card>
        </View>
      </ThemedScreen>
    );
  }

  return (
    <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Card accent padding="lg">
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>Drill</Text>
              <Text style={styles.h1} numberOfLines={2}>
                {drill.title}
              </Text>
              <Text style={styles.subtitle}>
                {drill.fachrichtung}
                {caseTitle ? ` • ${caseTitle}` : ""}
              </Text>
            </View>

            <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
          </View>

          <View style={styles.metaRow}>
            <MetaPill label="gemacht" value={`${drill.doneCount ?? 0}×`} />
            <MetaPill label="zuletzt" value={`${fmt((drill as any)?.lastDoneAt)}`} />
            <MetaPill label="Dauer" value={durationLabel} />
          </View>
        </Card>

        {/* Why */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Warum dieser Drill?</Text>
            <Text style={styles.body}>{drill.why}</Text>

            <View
              style={[
                styles.softPanel,
                { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) },
              ]}
            >
              <Text style={styles.smallHint}>
                Ablauf: <Text style={styles.strong}>1 Satz Einstieg</Text> →{" "}
                <Text style={styles.strong}>3 Kernpunkte</Text> →{" "}
                <Text style={styles.strong}>Abschlussfrage</Text>.
              </Text>
            </View>
          </Card>
        </View>

        {/* Timer */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>Timer</Text>
              <Chip text={running ? "läuft" : "bereit"} selected={running} tone="soft" />
            </View>

            <View style={styles.timerChips}>
              <Chip text="60s" selected={duration === 60} onPress={() => setDuration(60)} tone="soft" />
              <Chip text="2 min" selected={duration === 120} onPress={() => setDuration(120)} tone="soft" />
              <Chip text="3 min" selected={duration === 180} onPress={() => setDuration(180)} tone="soft" />
            </View>

            <View
              style={[
                styles.timerPanel,
                { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) },
              ]}
            >
              <Text style={styles.timerText}>{mmss(secondsLeft)}</Text>

              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: rgba(tokens.tint, 0.1), borderColor: rgba(tokens.tint, 0.16) },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPct}%`, backgroundColor: rgba(tokens.tint, 0.55) },
                  ]}
                />
              </View>

              <Text style={styles.progressHint}>{progressPct}%</Text>
            </View>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <VButton title={running ? "Pause" : "Start"} variant="cta" onPress={startPause} />
              </View>
              <View style={{ flex: 1 }}>
                <VButton title="Reset" variant="outline" onPress={reset} />
              </View>
            </View>

            <Text style={styles.smallHint}>
              Tipp: Sprich laut. Ziel: <Text style={styles.strong}>klar + priorisiert</Text> (Top 3 statt Liste).
            </Text>
          </Card>
        </View>

        {/* Self-check */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Self-Check (30 Sekunden)</Text>

            <View style={styles.checkList}>
              <Text style={styles.body}>• Struktur: klarer Start?</Text>
              <Text style={styles.body}>• Priorisierung: Top 3?</Text>
              <Text style={styles.body}>• Abschluss: Rückfrage gestellt?</Text>
            </View>

            <VButton title="Erledigt markieren" variant="cta" onPress={finish} style={{ marginTop: 14 }} />
            <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
          </Card>
        </View>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  scrollPad: { padding: 16, paddingBottom: 44 },
  block: { marginTop: 12 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  headerGhost: { paddingHorizontal: 4 },

  overline: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  h1: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  metaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },
  metaPill: { borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, minWidth: 100, flexGrow: 1 },
  metaValue: { fontSize: 18, fontWeight: "900", color: colors.text },
  metaLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted, marginTop: 2 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  body: { color: colors.text, lineHeight: 20, fontWeight: "700" },
  muted: { color: colors.textMuted, lineHeight: 18, marginTop: 10, fontWeight: "800" },
  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 12 },
  strong: { color: colors.text, fontWeight: "900" },

  softPanel: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },

  timerChips: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 },

  timerPanel: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 14, marginTop: 12 },
  timerText: { fontSize: 44, fontWeight: "900", color: colors.text, textAlign: "center" },

  progressTrack: { height: 10, borderRadius: 999, borderWidth: 1, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 999 },
  progressHint: { textAlign: "center", marginTop: 8, color: colors.textMuted, fontWeight: "900", fontSize: 12 },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },

  checkList: { marginTop: 6, gap: 6 },
});
