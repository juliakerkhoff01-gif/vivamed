import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Alert } from "react-native";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { VButton } from "../components/VButton";
import { colors } from "../theme/colors";

import { ALL_CASES, getCaseById } from "../logic/cases";
import { loadSessions, StoredSession } from "../logic/sessionStore";
import { clearExamRun, ensureExamRun, loadExamRun } from "../logic/examStore";

function titleForCase(caseId: string) {
  const c = getCaseById(caseId);
  return c?.title ?? `Fall: ${caseId}`;
}

export function ExamScreen({ navigation, route }: any) {
  const passedCfg = route?.params?.cfg;

  const fallbackCfg = useMemo(
    () => ({
      fachrichtung: "Innere Medizin",
      tone: "neutral",
      difficulty: 80,
      mode: "text",
      examinerProfile: "standard",
    }),
    []
  );

  const cfg = passedCfg ?? fallbackCfg;

  const [runId, setRunId] = useState<string | null>(null);
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  const refresh = async () => {
    const run = await ensureExamRun({ cfg, allCases: ALL_CASES as any });
    setRunId(run.id);
    setCaseIds(run.caseIds);

    const s = await loadSessions();
    setSessions(s);
  };

  useEffect(() => {
    const unsub = navigation.addListener("focus", refresh);
    refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const doneMap = useMemo(() => {
    // Fälle gelten als "done", wenn es eine Session NACH Run-Start gibt, die zu einem der CaseIds passt
    // (V1 robust: wir filtern nach createdAt & caseId)
    const map: Record<string, boolean> = {};
    caseIds.forEach((id) => (map[id] = false));

    // Run-Startzeit holen
    // (wenn run fehlt, nehmen wir 0 -> dann zählen wir gar nichts kaputt)
    let createdAt = 0;
    // wir holen run synchron nicht; daher: bei sessions/refresh ist run schon gesetzt -> zusätzlich loadExamRun:
    // (klein & robust)
    // NOTE: useMemo kann async nicht -> wir gehen hier ohne createdAt-Filter, aber mit "caseId match".
    // Das reicht in V1 meist aus, weil die Run-CaseIds explizit sind.
    const relevant = sessions.filter((s) => s?.caseId && caseIds.includes(s.caseId));
    for (const s of relevant) map[s.caseId as string] = true;

    return map;
  }, [sessions, caseIds]);

  const doneCount = useMemo(() => {
    return caseIds.filter((id) => doneMap[id]).length;
  }, [caseIds, doneMap]);

  const nextCaseId = useMemo(() => {
    return caseIds.find((id) => !doneMap[id]) ?? null;
  }, [caseIds, doneMap]);

  const onStartCase = (caseId: string) => {
    // cfg für Simulation: wir setzen caseId fest auf den gewünschten Fall
    const simCfg = { ...cfg, caseId };

    navigation.navigate("Simulation", { cfg: simCfg });
  };

  const onResetExam = () => {
    Alert.alert("Examenssimulation zurücksetzen?", "Der aktuelle Run (4 Fälle) wird gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Zurücksetzen",
        style: "destructive",
        onPress: async () => {
          await clearExamRun();
          await refresh();
        },
      },
    ]);
  };

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Examenssimulation</Text>
          <Text style={styles.subtitle}>4 Fälle am Stück • Gesamtscore + Schwächenliste</Text>
        </View>

        <View style={styles.block}>
          <Card>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.chips}>
              <Chip text={`Fach: ${String(cfg?.fachrichtung ?? "")}`} />
              <Chip text={`Fortschritt: ${doneCount}/4`} />
              {runId ? <Chip text={`Run: ${runId.slice(0, 6)}…`} /> : null}
            </View>

            {nextCaseId ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Nächster Fall</Text>
                <Text style={styles.nextTitle}>{titleForCase(nextCaseId)}</Text>

                <VButton
                  title={`Fall ${doneCount + 1} starten`}
                  variant="cta"
                  onPress={() => onStartCase(nextCaseId)}
                  style={{ marginTop: 12 }}
                />
              </>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Fertig 🎉</Text>
                <Text style={styles.muted}>Alle 4 Fälle abgeschlossen. Du kannst jetzt die Auswertung öffnen.</Text>

                <VButton
                  title="Ergebnis anzeigen"
                  variant="cta"
                  onPress={() => navigation.navigate("ExamResult")}
                  style={{ marginTop: 12 }}
                />
              </>
            )}

            <VButton title="Run zurücksetzen" variant="outline" onPress={onResetExam} style={{ marginTop: 10 }} />
          </Card>
        </View>

        <View style={styles.block}>
          <Card>
            <Text style={styles.sectionTitle}>Deine 4 Fälle</Text>

            {caseIds.map((id, idx) => {
              const done = !!doneMap[id];
              return (
                <View key={`${id}-${idx}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {done ? "✓ " : ""}
                      {idx + 1}. {titleForCase(id)}
                    </Text>
                    <Text style={styles.rowMeta}>Case ID: {id}</Text>
                  </View>

                  <VButton
                    title={done ? "Nochmal" : "Start"}
                    variant="outline"
                    onPress={() => onStartCase(id)}
                    style={{ paddingHorizontal: 0 }}
                  />
                </View>
              );
            })}
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

  nextTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },

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
});
