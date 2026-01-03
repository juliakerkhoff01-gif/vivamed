// src/screens/TrainingScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { canOpenTraining, markDemoDrillUsed, loadAppSettings } from "../logic/appSettings";
import { loadDrills } from "../logic/drillStore";
import { loadSessions, StoredSession } from "../logic/sessionStore";

type Drill = {
  id: string;
  title: string;
  why?: string;
  doneCount?: number;
  createdAt?: number;
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

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function topFromMap(map: Map<string, number>, n: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function buildTopMissingTagsFromSessions(sessions: StoredSession[]) {
  // basiert auf FeedbackScreen -> saveSession({ missingTags: [...] })
  const map = new Map<string, number>();

  for (const s of sessions ?? []) {
    const arr = Array.isArray((s as any)?.missingTags) ? (s as any).missingTags : [];
    for (const t of arr) {
      const key = norm(t);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return topFromMap(map, 10); // top 10 missing tags
}

function buildTopDrillTitlesFromSessions(sessions: StoredSession[]) {
  // basiert auf FeedbackScreen -> saveSession({ drillTitles: [...] })
  const map = new Map<string, number>();

  for (const s of sessions ?? []) {
    const arr = Array.isArray((s as any)?.drillTitles) ? (s as any).drillTitles : [];
    for (const t of arr) {
      const key = norm(t);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return topFromMap(map, 6); // top 6 drill titles
}

function titleMatchesTag(titleNorm: string, tagNorm: string) {
  if (!titleNorm || !tagNorm) return false;
  // robust: "tag" in "title" oder umgekehrt
  return titleNorm.includes(tagNorm) || tagNorm.includes(titleNorm);
}

export function TrainingScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  const [drills, setDrills] = useState<Drill[]>([]);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [demoUsed, setDemoUsed] = useState(false);

  const refresh = async () => {
    try {
      const s = await loadAppSettings();
      setIsPro(!!s?.isPro);
      setDemoUsed(!!s?.demoDrillUsed);
    } catch {
      setIsPro(false);
      setDemoUsed(false);
    }

    try {
      const sess = await loadSessions();
      setSessions(sess ?? []);
    } catch {
      setSessions([]);
    }

    try {
      const list = (await loadDrills()) as any[];
      setDrills(Array.isArray(list) ? (list as Drill[]) : []);
    } catch {
      setDrills([]);
    }
  };

  useEffect(() => {
    const unsub = navigation?.addListener?.("focus", refresh);
    refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const locked = useMemo(() => !isPro && demoUsed, [isPro, demoUsed]);
  const onOpenPaywall = () => navigation.navigate("Paywall", { reason: "Drills" });

  const onStartDrill = async (drillId: string) => {
    const gate = await canOpenTraining();
    if (!gate.ok) {
      Alert.alert("Pro erforderlich", gate.reason ?? "Für Drills brauchst du Pro.", [
        { text: "Abbrechen", style: "cancel" },
        { text: "Pro holen", onPress: onOpenPaywall },
      ]);
      return;
    }

    try {
      await markDemoDrillUsed(); // bei Pro no-op
    } catch {}

    try {
      const s2 = await loadAppSettings();
      setIsPro(!!s2?.isPro);
      setDemoUsed(!!s2?.demoDrillUsed);
    } catch {}

    navigation.navigate("DrillPlayer", { drillId, id: drillId });
  };

  // ✅ Top Missing Tags + Top Drill Titles aus Sessions
  const topMissing = useMemo(() => buildTopMissingTagsFromSessions(sessions), [sessions]);
  const topDrillTitles = useMemo(() => buildTopDrillTitlesFromSessions(sessions), [sessions]);

  const topMissingSet = useMemo(() => new Set(topMissing.map((x) => norm(x.key))), [topMissing]);
  const topDrillTitleSet = useMemo(() => new Set(topDrillTitles.map((x) => norm(x.key))), [topDrillTitles]);

  // ✅ Empfehlung: zuerst über missingTags matchen, dann über drillTitles (Fallback)
  const isRecommended = (d: Drill) => {
    const t = norm(d?.title);

    // 1) MissingTag match (stärker)
    for (const tag of topMissingSet) {
      if (titleMatchesTag(t, tag)) return true;
    }

    // 2) DrillTitle match (Fallback)
    for (const dt of topDrillTitleSet) {
      if (titleMatchesTag(t, dt)) return true;
    }

    return false;
  };

  // ✅ Sortierung: empfohlen zuerst → weniger doneCount → neuere createdAt
  const sortedDrills = useMemo(() => {
    const copy = [...(drills ?? [])];

    copy.sort((a, b) => {
      const aRec = isRecommended(a);
      const bRec = isRecommended(b);
      if (aRec !== bRec) return aRec ? -1 : 1;

      const aDone = Number(a?.doneCount ?? 0);
      const bDone = Number(b?.doneCount ?? 0);
      if (aDone !== bDone) return aDone - bDone;

      const aCreated = Number(a?.createdAt ?? 0);
      const bCreated = Number(b?.createdAt ?? 0);
      return bCreated - aCreated;
    });

    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drills, topMissingSet, topDrillTitleSet]);

  const recommendedDrills = useMemo(() => sortedDrills.filter((d) => isRecommended(d)), [sortedDrills]);
  const recommendedCount = recommendedDrills.length;
  const bestRecommendedId = recommendedDrills[0]?.id ?? null;

  const onStartBestRecommended = async () => {
    if (!bestRecommendedId) {
      Alert.alert(
        "Noch keine Empfehlung",
        "Mach 1–2 Simulationen → Feedback. Dann werden missingTags + Drills gespeichert und VivaMed kann besser empfehlen."
      );
      return;
    }
    await onStartDrill(bestRecommendedId);
  };

  // Optional: “Warum empfohlen” in 1 Zeile (Top Missing #1)
  const topMissingOne = topMissing?.[0]?.key ? String(topMissing[0].key) : "";

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Training</Text>
            <Text style={styles.subtitle}>Drills zum Wiederholen • 2–3 Minuten</Text>
          </View>

          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* Status + 1-Tap CTA */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Chip text={isPro ? "✅ Pro aktiv" : "🔒 Demo"} tone="soft" selected={isPro} />
              {isPro ? (
                <Chip text="Unbegrenzt" tone="soft" />
              ) : (
                <Chip text={demoUsed ? "Demo-Drill: verbraucht" : "Demo-Drill: verfügbar"} tone="soft" />
              )}
              <Chip text={`Empfohlen: ${recommendedCount}`} tone="soft" />

              {!isPro ? (
                <Pressable onPress={onOpenPaywall} style={{ marginLeft: "auto" }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>Pro holen →</Text>
                </Pressable>
              ) : null}
            </View>

            {/* ✅ 1-Tap Empfehlungs-CTA */}
            {bestRecommendedId ? (
              <View style={{ marginTop: 12 }}>
                <VButton
                  title={locked ? "Empfohlenen Drill starten (gesperrt)" : "⭐ Empfohlenen Drill starten"}
                  variant={locked ? "outline" : "cta"}
                  onPress={onStartBestRecommended}
                />
                <Text style={[styles.noteText, { marginTop: 8 }]}>
  Empfehlung basiert auf deinen häufigsten Lücken{topMissingOne ? ` (z.B. „${topMissingOne}“).` : "."}
</Text>

              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.noteText}>
                  Noch keine Empfehlung. Starte 1 Simulation → Feedback, dann erscheinen hier Drills & Empfehlungen.
                </Text>
              </View>
            )}

            {locked ? (
              <View
                style={[
                  styles.note,
                  {
                    borderColor: rgba(tokens.tint, 0.16),
                    backgroundColor: rgba(tokens.tint, 0.05),
                  },
                ]}
              >
                <Text style={styles.noteText}>
                  Dein Demo-Drill ist verbraucht. Für alle weiteren Drills brauchst du VivaMed Pro.
                </Text>
                <VButton title="Pro holen" variant="cta" onPress={onOpenPaywall} style={{ marginTop: 10 }} />
              </View>
            ) : null}
          </Card>
        </View>

        {/* Drill list */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>Deine Drills</Text>
              <VButton title="Aktualisieren" variant="ghost" onPress={refresh} style={styles.inlineGhost} />
            </View>

            {sortedDrills.length === 0 ? (
              <Text style={styles.muted}>
                Noch keine Drills da. Tipp: Starte eine Simulation → Feedback → dort werden Drills automatisch generiert.
              </Text>
            ) : (
              sortedDrills.map((d) => {
                const rec = isRecommended(d);
                const done = Number(d.doneCount ?? 0);

                return (
                  <Pressable
                    key={d.id}
                    onPress={() => onStartDrill(d.id)}
                    disabled={locked}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderColor: rec ? rgba(tokens.tint, 0.22) : rgba(tokens.tint, 0.12),
                        backgroundColor: colors.surface,
                        opacity: locked ? 0.55 : pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Text style={styles.drillTitle} numberOfLines={2}>
                          {d.title}
                        </Text>
                        {rec ? <Chip text="⭐ Empfohlen" tone="soft" selected /> : null}
                      </View>

                      {d.why ? (
                        <Text style={styles.muted} numberOfLines={2}>
                          {d.why}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Chip text={`✓ ${done}`} tone="soft" />
                      <Text style={[styles.muted, { fontSize: 11 }]}>{locked ? "🔒" : "Start"}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
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

  note: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  inlineGhost: { paddingHorizontal: 0 },

  row: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  drillTitle: { color: colors.text, fontWeight: "900", lineHeight: 18 },
  muted: { color: colors.textMuted, lineHeight: 18, fontWeight: "800", marginTop: 6 },
});
