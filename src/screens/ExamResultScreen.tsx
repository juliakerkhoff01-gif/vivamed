import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";
import { colors } from "../theme/colors";

import { loadSessions, StoredSession } from "../logic/sessionStore";
import { loadExamRun, clearExamRun } from "../logic/examStore";
import { getCaseById } from "../logic/cases";

function avg(nums: number[]) {
  const clean = nums.filter((n) => Number.isFinite(n)) as number[];
  if (!clean.length) return 0;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function safeNum(n: any) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function ExamResultScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [run, setRun] = useState<any>(null);

  const refresh = async () => {
    const r = await loadExamRun();
    setRun(r);

    const s = await loadSessions();
    setSessions(s);
  };

  useEffect(() => {
    const unsub = navigation.addListener("focus", refresh);
    refresh();
    return unsub;
  }, [navigation]);

  const runSessions = useMemo(() => {
    if (!run?.caseIds?.length) return [];
    // V1: Sessions zu den 4 CaseIds (egal wann). In der Praxis passt das gut,
    // weil du diese CaseIds explizit im Run hast.
    // Wenn du später “createdAt” streng nutzen willst, sag Bescheid.
    return sessions
      .filter((s) => s?.caseId && run.caseIds.includes(s.caseId))
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [sessions, run]);

  const summary = useMemo(() => {
    const overall = avg(runSessions.map((s) => safeNum((s as any).overallScore)));
    const ddx = avg(runSessions.map((s) => safeNum((s as any)?.phaseScores?.ddx)));
    const diagnostics = avg(runSessions.map((s) => safeNum((s as any)?.phaseScores?.diagnostics)));
    const management = avg(runSessions.map((s) => safeNum((s as any)?.phaseScores?.management)));
    const closing = avg(runSessions.map((s) => safeNum((s as any)?.phaseScores?.closing)));

    const skills = [
      { label: "DDx", value: ddx },
      { label: "Diagnostik", value: diagnostics },
      { label: "Management", value: management },
      { label: "Kommunikation", value: closing },
    ].sort((a, b) => a.value - b.value);

    return {
      overall,
      skillsSorted: skills,
      weaknesses: skills.slice(0, 2),
    };
  }, [runSessions]);

  const onNewRun = async () => {
    await clearExamRun();
    navigation.navigate("Exam");
  };

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Examens-Auswertung</Text>
          <Text style={styles.subtitle}>Gesamtscore + Schwächenliste aus deinen 4 Fällen</Text>
        </View>

        <View style={styles.block}>
          <Card>
            <Text style={styles.sectionTitle}>Gesamt</Text>
            <View style={styles.chips}>
              <Chip text={`Fach: ${run?.fachrichtung ?? "-"}`} />
              <Chip text={`Fälle: ${run?.caseIds?.length ?? 0}/4`} />
              <Chip text={`Gesamtscore: ${Math.round(summary.overall)}%`} />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Schwächenliste</Text>
            {summary.weaknesses.map((w) => (
              <Text key={w.label} style={styles.muted}>
                • {w.label}: {Math.round(w.value)}% → mehr Drills + strukturierter antworten
              </Text>
            ))}

            <VButton title="Neuen Exam starten" variant="cta" onPress={onNewRun} style={{ marginTop: 14 }} />
            <VButton title="Zurück" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
          </Card>
        </View>

        <View style={styles.block}>
          <Card>
            <Text style={styles.sectionTitle}>Deine Fälle</Text>

            {runSessions.length === 0 ? (
              <Text style={styles.muted}>Noch keine passenden Sessions gefunden. Mach erst die 4 Fälle.</Text>
            ) : (
              run?.caseIds?.map((id: string, idx: number) => {
                const best = runSessions.find((s) => s.caseId === id);
                const c = getCaseById(id);
                const title = c?.title ?? `Fall: ${id}`;

                return (
                  <View key={`${id}-${idx}`} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {idx + 1}. {title}
                      </Text>
                      <Text style={styles.rowMeta}>Case ID: {id}</Text>
                    </View>
                    <Text style={styles.score}>{Math.round(safeNum((best as any)?.overallScore))}%</Text>
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 28 },
  header: { marginBottom: 12 },

  title: { fontSize: 26, fontWeight: "900", color: colors.primary },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  block: { marginTop: 12 },

  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 14, marginBottom: 10 },

  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },

  muted: { color: colors.textMuted, lineHeight: 18 },

  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  rowTitle: { color: colors.text, fontWeight: "800" },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  score: { color: colors.primary, fontWeight: "900", fontSize: 18 },
});
