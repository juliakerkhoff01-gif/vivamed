// src/screens/ProgressScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { loadSessions, StoredSession } from "../logic/sessionStore";
import { loadDrills } from "../logic/drillStore";
import { canOpenTraining, markDemoDrillUsed, loadAppSettings } from "../logic/appSettings";

type Drill = {
  id: string;
  createdAt?: number;
  fachrichtung?: string;
  caseId?: string;
  title: string;
  why?: string;
  doneCount?: number;
  lastDoneAt?: number;
  [key: string]: any;
};

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function startOfDayMs(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mondayStartMs(ts: number) {
  const d = new Date(ts);
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMon);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDDMM(ts: number) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type DayBucket = { dayMs: number; count: number; avgScore: number };

function computeStreak(dayMsSet: Set<number>) {
  const today = startOfDayMs(Date.now());
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = today - i * 24 * 60 * 60 * 1000;
    if (dayMsSet.has(d)) streak++;
    else break;
  }
  return streak;
}

function computeBucketsLast7Days(sessions: StoredSession[]): DayBucket[] {
  const today = startOfDayMs(Date.now());
  const map = new Map<number, { count: number; scoreSum: number; scoreN: number }>();

  for (let i = 0; i < 7; i++) {
    const dayMs = today - i * 24 * 60 * 60 * 1000;
    map.set(dayMs, { count: 0, scoreSum: 0, scoreN: 0 });
  }

  for (const s of sessions) {
    const dayMs = startOfDayMs(s.ts);
    const v = map.get(dayMs);
    if (!v) continue;
    v.count += 1;

    const sc = Number((s as any)?.overallScore);
    if (Number.isFinite(sc)) {
      v.scoreSum += sc;
      v.scoreN += 1;
    }
  }

  const out: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayMs = today - i * 24 * 60 * 60 * 1000;
    const v = map.get(dayMs)!;
    out.push({
      dayMs,
      count: v.count,
      avgScore: v.scoreN ? Math.round(v.scoreSum / v.scoreN) : 0,
    });
  }
  return out;
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleMatchesTag(titleNorm: string, tagNorm: string) {
  if (!titleNorm || !tagNorm) return false;
  return titleNorm.includes(tagNorm) || tagNorm.includes(titleNorm);
}

function pickRecommendedDrillId(params: {
  drills: Drill[];
  topMissing: Array<{ tag: string; n: number }>;
  topDrills: Array<{ title: string; n: number }>;
}): string | null {
  const { drills, topMissing, topDrills } = params;
  if (!Array.isArray(drills) || drills.length === 0) return null;

  // 1) MissingTags match (stärker)
  for (const m of topMissing ?? []) {
    const tag = norm(m.tag);
    if (!tag) continue;

    const matches = drills.filter((d) => titleMatchesTag(norm(d?.title), tag));
    if (matches.length) {
      matches.sort((a, b) => {
        const da = Number(a.doneCount ?? 0);
        const db = Number(b.doneCount ?? 0);
        if (da !== db) return da - db;
        return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
      });
      return matches[0]?.id ?? null;
    }
  }

  // 2) DrillTitles match (Fallback)
  for (const td of topDrills ?? []) {
    const target = norm(td.title);
    if (!target) continue;

    const matches = drills.filter((d) => titleMatchesTag(norm(d?.title), target));
    if (matches.length) {
      matches.sort((a, b) => {
        const da = Number(a.doneCount ?? 0);
        const db = Number(b.doneCount ?? 0);
        if (da !== db) return da - db;
        return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
      });
      return matches[0]?.id ?? null;
    }
  }

  // 3) fallback: “irgendein Drill” (wenig gemacht, neu)
  const copy = [...drills];
  copy.sort((a, b) => {
    const da = Number(a.doneCount ?? 0);
    const db = Number(b.doneCount ?? 0);
    if (da !== db) return da - db;
    return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
  });
  return copy[0]?.id ?? null;
}

export function ProgressScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  const [isPro, setIsPro] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await loadAppSettings();
      setIsPro(!!s?.isPro);

      const sess = await loadSessions();
      setSessions(sess ?? []);

      const d = (await loadDrills()) as any[];
      setDrills(Array.isArray(d) ? (d as Drill[]) : []);
    } catch {
      setSessions([]);
      setDrills([]);
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener("focus", refresh);
    refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const stats = useMemo(() => {
    const now = Date.now();
    const todayMs = startOfDayMs(now);
    const weekStartMs = mondayStartMs(now);

    let total = sessions.length;
    let todayCount = 0;
    let weekCount = 0;

    let scoreSum = 0;
    let scoreN = 0;

    const daySet = new Set<number>();
    const fachCounts = new Map<string, number>();

    const missingCounts = new Map<string, number>();
    const drillCounts = new Map<string, number>();

    for (const s of sessions) {
      const dayMs = startOfDayMs(s.ts);
      daySet.add(dayMs);

      if (dayMs === todayMs) todayCount++;
      if (s.ts >= weekStartMs) weekCount++;

      const fr = String((s as any)?.fachrichtung ?? "Unbekannt");
      fachCounts.set(fr, (fachCounts.get(fr) ?? 0) + 1);

      const sc = Number((s as any)?.overallScore);
      if (Number.isFinite(sc)) {
        scoreSum += sc;
        scoreN += 1;
      }

      const missing = Array.isArray((s as any)?.missingTags) ? (s as any).missingTags : [];
      for (const t of missing) {
        const key = String(t ?? "").trim();
        if (!key) continue;
        missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
      }

      const drillsTitles = Array.isArray((s as any)?.drillTitles) ? (s as any).drillTitles : [];
      for (const d of drillsTitles) {
        const key = String(d ?? "").trim();
        if (!key) continue;
        drillCounts.set(key, (drillCounts.get(key) ?? 0) + 1);
      }
    }

    const avgScoreAll = scoreN ? Math.round(scoreSum / scoreN) : 0;

    const topFach = [...fachCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, n]) => ({ name, n }));

    const topMissing = [...missingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, n]) => ({ tag, n }));

    const topDrills = [...drillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([title, n]) => ({ title, n }));

    const streak = computeStreak(daySet);
    const last7 = computeBucketsLast7Days(sessions);
    const maxCount = Math.max(1, ...last7.map((b) => b.count));

    return {
      total,
      todayCount,
      weekCount,
      avgScoreAll,
      streak,
      topFach,
      last7,
      maxCount,
      topMissing,
      topDrills,
    };
  }, [sessions]);

  const recommendedDrillId = useMemo(() => {
    return pickRecommendedDrillId({
      drills,
      topMissing: stats.topMissing ?? [],
      topDrills: stats.topDrills ?? [],
    });
  }, [drills, stats.topMissing, stats.topDrills]);

  const goHome = () => navigation.popToTop();
  const openPaywall = () => navigation.navigate("Paywall", { reason: "Fortschritt" });

  const showDeepStats = isPro;

  const onStartRecommendedDrill = async () => {
    if (!recommendedDrillId) {
      Alert.alert("Noch kein Drill", "Erstelle erst Drills über: Simulation → Feedback. Dann erscheint hier eine Empfehlung.");
      return;
    }

    const gate = await canOpenTraining();
    if (!gate.ok) {
      Alert.alert("Pro erforderlich", gate.reason ?? "Für Drills brauchst du Pro.", [
        { text: "Abbrechen", style: "cancel" },
        { text: "Pro holen", onPress: () => navigation.navigate("Paywall", { reason: "Drills" }) },
      ]);
      return;
    }

    try {
      await markDemoDrillUsed();
    } catch {}

    navigation.navigate("DrillPlayer", { drillId: recommendedDrillId, id: recommendedDrillId });
  };

  const proGateText = isPro
    ? "Pro aktiv: volle Statistiken & Verlauf"
    : "Demo: Statistiken sind eingeschränkt. Pro schaltet Verlauf, Trends & Empfehlungen frei.";

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Fortschritt</Text>
            <Text style={styles.subtitle}>{proGateText}</Text>
          </View>
          <VButton title="Home" variant="ghost" onPress={goHome} style={styles.headerGhost} />
        </View>

        {/* KPIs */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Übersicht</Text>

            {loading ? (
              <Text style={styles.muted}>Lade Daten…</Text>
            ) : (
              <View style={styles.kpiRow}>
                <View style={[styles.kpi, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.08) }]}>
                  <Text style={styles.kpiValue}>{stats.weekCount}</Text>
                  <Text style={styles.kpiLabel}>Diese Woche</Text>
                </View>

                <View style={[styles.kpi, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.08) }]}>
                  <Text style={styles.kpiValue}>{stats.todayCount}</Text>
                  <Text style={styles.kpiLabel}>Heute</Text>
                </View>

                <View style={[styles.kpi, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.08) }]}>
                  <Text style={styles.kpiValue}>{stats.streak}</Text>
                  <Text style={styles.kpiLabel}>Streak (Tage)</Text>
                </View>

                <View style={[styles.kpi, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.08) }]}>
                  <Text style={styles.kpiValue}>{stats.total}</Text>
                  <Text style={styles.kpiLabel}>Gesamt</Text>
                </View>
              </View>
            )}

            {!isPro ? (
              <View style={{ marginTop: 12 }}>
                <VButton title="Pro freischalten" variant="cta" onPress={openPaywall} />
              </View>
            ) : null}
          </Card>
        </View>

        {/* Last 7 days */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Letzte 7 Tage</Text>
            <Text style={styles.muted}>Sessions pro Tag</Text>

            <View style={styles.barRow}>
              {stats.last7.map((b) => {
                const h = clamp(Math.round((b.count / stats.maxCount) * 46), 6, 46);
                const isZero = b.count === 0;
                return (
                  <View key={String(b.dayMs)} style={styles.barItem}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: h,
                          backgroundColor: isZero ? rgba(tokens.tint, 0.10) : rgba(tokens.tint, 0.22),
                          borderColor: rgba(tokens.tint, 0.18),
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{formatDDMM(b.dayMs)}</Text>
                    <Text style={styles.barCount}>{b.count}</Text>
                  </View>
                );
              })}
            </View>

            {showDeepStats ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.muted}>Ø Score (alle Sessions): {stats.avgScoreAll ? `${stats.avgScoreAll}%` : "—"}</Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.muted}>Pro zeigt hier zusätzlich Score-Trends & Themen-Lücken.</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Lücken + 1-Tap Drill */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Deine häufigsten Lücken</Text>

            {!sessions.length ? (
              <Text style={styles.muted}>Noch keine Daten. Mach 1–2 Simulationen, dann wird’s spannend.</Text>
            ) : !showDeepStats ? (
              <Text style={styles.muted}>Pro zeigt hier deine Top-Lücken & Empfehlungen.</Text>
            ) : stats.topMissing?.length ? (
              <View style={styles.chips}>
                {stats.topMissing.map((x: any) => (
                  <Chip key={x.tag} text={`${x.tag} • ${x.n}`} tone="soft" />
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Noch keine Lücken erkannt.</Text>
            )}

            {recommendedDrillId ? (
              <View style={{ marginTop: 12 }}>
                <VButton
                  title={isPro ? "Empfohlenen Drill starten" : "Empfohlenen Drill starten (Demo/Pro)"}
                  variant="cta"
                  onPress={onStartRecommendedDrill}
                />
                <Text style={[styles.muted, { marginTop: 8, fontSize: 12 }]}>
                  Empfehlung: matching auf deine häufigsten missingTags (Lücken) + Drill-Themen.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.muted}>
                  Noch keine Drill-Empfehlung. Starte 1 Simulation → Feedback, dann werden Drills erzeugt.
                </Text>
              </View>
            )}

            {!isPro ? (
              <View style={{ marginTop: 12 }}>
                <VButton title="Pro freischalten" variant="outline" onPress={openPaywall} />
              </View>
            ) : null}
          </Card>
        </View>

        {/* Quick actions */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Aktionen</Text>
            <VButton title="Aktualisieren" variant="outline" onPress={refresh} />
            <VButton title="Zurück nach Home" variant="ghost" onPress={goHome} style={{ marginTop: 10 }} />

            {isPro ? (
              <Pressable
                onPress={() => navigation.navigate("Settings")}
                style={({ pressed }) => [
                  styles.linkRow,
                  { borderColor: rgba(tokens.tint, 0.14), backgroundColor: rgba(tokens.tint, 0.06) },
                  pressed ? { opacity: 0.88 } : null,
                ]}
              >
                <Text style={styles.linkText}>Settings öffnen →</Text>
              </Pressable>
            ) : null}
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

  block: { marginTop: 12 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  muted: { color: colors.textMuted, lineHeight: 18, fontWeight: "800", marginTop: 6 },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  kpi: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, minWidth: 140, flexGrow: 1 },
  kpiValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  kpiLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted, marginTop: 2 },

  barRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" },
  barItem: { width: 44, alignItems: "center" },
  bar: { width: 34, borderWidth: 1, borderRadius: 12 },
  barLabel: { marginTop: 6, fontSize: 10, fontWeight: "900", color: colors.textMuted },
  barCount: { marginTop: 2, fontSize: 12, fontWeight: "900", color: colors.text },

  chips: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },

  linkRow: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12 },
  linkText: { color: colors.text, fontWeight: "900" },
});
