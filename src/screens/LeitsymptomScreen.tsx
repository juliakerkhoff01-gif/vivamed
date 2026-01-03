import React, { useMemo, useState, useEffect } from "react";
import { ScrollView, View, Text, StyleSheet, Alert } from "react-native";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { SelectField } from "../components/SelectField";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";
import { colors } from "../theme/colors";

import { ALL_CASES, getCaseById } from "../logic/cases";
import { LEITSYMPTOM_CLUSTERS, getCasesForCluster } from "../logic/leitsymptom";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function LeitsymptomScreen({ navigation, route }: any) {
  const passedCfg = route?.params?.cfg;

  // Fallback, falls jemand direkt hier landet
  const fallbackCfg = useMemo(
    () => ({
      fachrichtung: "Innere Medizin",
      tone: "neutral",
      difficulty: 65,
      mode: "text",
      examinerProfile: "standard",
    }),
    []
  );

  const baseCfg = passedCfg ?? fallbackCfg;

  const fachrichtungen = useMemo(
    () => [
      { label: "Innere Medizin", value: "Innere Medizin" },
      { label: "Chirurgie", value: "Chirurgie" },
      { label: "Pädiatrie", value: "Pädiatrie" },
      { label: "Gynäkologie", value: "Gynäkologie" },
      { label: "Neurologie", value: "Neurologie" },
      { label: "Anästhesie/Intensiv", value: "Anästhesie/Intensiv" },
    ],
    []
  );

  const clusterItems = useMemo(
    () => LEITSYMPTOM_CLUSTERS.map((c) => ({ label: c.label, value: c.id })),
    []
  );

  const [fachrichtung, setFachrichtung] = useState<string>(String(baseCfg.fachrichtung ?? "Innere Medizin"));
  const [clusterId, setClusterId] = useState<string>(clusterItems[0]?.value ?? "thoraxschmerz");

  // wenn Home cfg wechselt, initial nachziehen (V1)
  useEffect(() => {
    setFachrichtung(String(baseCfg.fachrichtung ?? "Innere Medizin"));
  }, [baseCfg?.fachrichtung]);

  const { pool, matches, clusterLabel } = useMemo(() => {
    return getCasesForCluster({
      cases: ALL_CASES as any,
      fachrichtung,
      clusterId,
    });
  }, [fachrichtung, clusterId]);

  const onStartRandom = () => {
    if (!matches.length) {
      Alert.alert(
        "Keine passenden Fälle",
        `Für „${clusterLabel}“ gibt es aktuell keine passenden Fälle in ${fachrichtung}. Starte stattdessen zufällig aus der Fachrichtung.`
      );
      const fallbackPool = (pool.length ? pool : (ALL_CASES as any)) as Array<{ id: string }>;
const chosenFallback = pickRandom(fallbackPool);
const cfg = { ...baseCfg, fachrichtung, caseId: chosenFallback.id };
      navigation.navigate("Simulation", { cfg });
      return;
    }

    const chosen = pickRandom(matches);
    const cfg = { ...baseCfg, fachrichtung, caseId: chosen.id };
    navigation.navigate("Simulation", { cfg });
  };

  const onStartCase = (caseId: string) => {
    const cfg = { ...baseCfg, fachrichtung, caseId };
    navigation.navigate("Simulation", { cfg });
  };

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Leitsymptom-Modus</Text>
          <Text style={styles.subtitle}>Wähle ein Leitsymptom → starte random oder gezielt.</Text>
        </View>

        <View style={styles.block}>
          <Card>
            <SelectField label="Fachrichtung" value={fachrichtung} onChange={setFachrichtung} items={fachrichtungen} />

            <SelectField label="Leitsymptom" value={clusterId} onChange={setClusterId} items={clusterItems} />

            <View style={styles.chips}>
              <Chip text={`Cluster: ${clusterLabel}`} />
              <Chip text={`Matches: ${matches.length}`} />
              <Chip text={`Fälle im Fach: ${pool.length}`} />
            </View>

            <VButton
              title="Random Fall starten"
              variant="cta"
              onPress={onStartRandom}
              style={{ marginTop: 12 }}
            />

            <VButton
              title="Zurück"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 10 }}
            />
          </Card>
        </View>

        <View style={styles.block}>
          <Card>
            <Text style={styles.sectionTitle}>Passende Fälle</Text>

            {matches.length === 0 ? (
              <Text style={styles.muted}>
                Noch keine Matches. (V1 erkennt Fälle über Keywords aus Titel/Vignette/Checklist.)
              </Text>
            ) : (
              matches.slice(0, 25).map((c: any) => {
                const title = getCaseById(c.id)?.title ?? c.title ?? `Fall: ${c.id}`;
                return (
                  <View key={c.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{title}</Text>
                      <Text style={styles.rowMeta}>{fachrichtung} • ID: {c.id}</Text>
                    </View>
                    <VButton title="Start" variant="outline" onPress={() => onStartCase(c.id)} />
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

  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },

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
});
