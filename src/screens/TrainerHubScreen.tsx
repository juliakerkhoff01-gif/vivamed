import React from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function QuickTile({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { tokens } = useSectionTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: rgba(tokens.tint, 0.14),
          backgroundColor: "#FFFFFF",
          shadowColor: "#000",
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.tileAccent, { backgroundColor: rgba(tokens.tint, 0.14) }]} />
      <View style={styles.tileTop}>
        <Text style={styles.tileIcon}>{icon}</Text>
        <Text style={styles.tileGo}>→</Text>
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.tileHint} numberOfLines={1}>
        {hint ?? "Öffnen"}
      </Text>
    </Pressable>
  );
}

export function TrainerHubScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  return (
    <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Trainer</Text>
            <Text style={styles.subtitle}>Kurze Module, klarer Ablauf — täglich 5–10 Minuten.</Text>
          </View>

          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* Hero */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.overline}>Empfohlen</Text>
            <Text style={styles.h1}>Heute: Drill (1–3 Min) + 1 Skill</Text>

            <View
              style={[
                styles.softPanel,
                { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) },
              ]}
            >
              <Text style={styles.smallHint}>
                Drills kommen automatisch aus deinen Debriefs. Trainer-Module folgen dem gleichen Prinzip:{" "}
                <Text style={styles.strong}>Systematik</Text> → <Text style={styles.strong}>Musterlösung</Text> →{" "}
                <Text style={styles.strong}>Wiederholung</Text>.
              </Text>
            </View>

            <View style={{ marginTop: 14 }}>
              <VButton title="Training öffnen" variant="cta" onPress={() => navigation.navigate("Training")} />
              <VButton
                title="Plan öffnen"
                variant="outline"
                onPress={() => navigation.navigate("Plan")}
                style={{ marginTop: 10 }}
              />
            </View>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.grid}>
            <QuickTile icon="🎯" label="Training" hint="Drills aus Debriefs" onPress={() => navigation.navigate("Training")} />
            <QuickTile icon="🫀" label="EKG-Trainer" hint="Rhythmus → Achse → ST/T" onPress={() => navigation.navigate("EkgTrainer")} />
            <QuickTile icon="🩻" label="Röntgen-Trainer" hint="Systematik & Befundsprache" onPress={() => navigation.navigate("RoentgenTrainer")} />
            <QuickTile icon="🏠" label="Home" hint="Coach & Tagesplan" onPress={() => navigation.navigate("Home")} />
          </View>
        </View>

        {/* EKG */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>EKG-Trainer</Text>
              <Text style={styles.badge}>v1</Text>
            </View>
            <Text style={styles.muted}>Analysepfad + Musterlösung. Perfekt für 5-Minuten-Training.</Text>

            <View style={{ marginTop: 14 }}>
              <VButton title="EKG öffnen" variant="cta" onPress={() => navigation.navigate("EkgTrainer")} />
            </View>
          </Card>
        </View>

        {/* Röntgen */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>Röntgen-Trainer</Text>
              <Text style={styles.badge}>v1</Text>
            </View>
            <Text style={styles.muted}>Thorax & Skelett: systematischer Blick, typische Fallen, Befundsprache.</Text>

            <View style={{ marginTop: 14 }}>
              <VButton title="Röntgen öffnen" variant="outline" onPress={() => navigation.navigate("RoentgenTrainer")} />
            </View>
          </Card>
        </View>

        <View style={styles.block}>
          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 44 },

  header: { flexDirection: "row", gap: 12, alignItems: "flex-end", marginBottom: 6 },
  headerGhost: { paddingHorizontal: 4 },

  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  block: { marginTop: 12 },

  overline: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  h1: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 10 },

  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginBottom: 8 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  tile: {
    width: "48%",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileAccent: { height: 7, borderRadius: 99, marginBottom: 10 },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tileIcon: { fontSize: 20 },
  tileGo: { color: colors.textMuted, fontWeight: "900" },
  tileLabel: { marginTop: 8, fontWeight: "900", color: colors.text },
  tileHint: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  pressed: { opacity: 0.82 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16 },
  muted: { color: colors.textMuted, lineHeight: 18, marginTop: 6, fontWeight: "800" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { color: colors.textMuted, fontWeight: "900", fontSize: 12 },

  softPanel: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  strong: { color: colors.text, fontWeight: "900" },
});
