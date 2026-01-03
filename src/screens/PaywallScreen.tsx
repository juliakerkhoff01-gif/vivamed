import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, Keyboard } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";
import { loadAppSettings, saveAppSettings, getDemoSimulationMeta } from "../logic/appSettings";

/**
 * ✅ V1: Code-based unlock (Beta)
 * Später ersetzen durch RevenueCat / In-App Purchase.
 *
 * WICHTIG: Codes sind nur für Beta/Test – im Release bitte über echtes IAP lösen.
 */
const VALID_PRO_CODES = ["VM-DEMO-2026", "VM-9K2F-R7Q1", "VM-4T8A-H2WZ"];

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function normalizeCode(input: string) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function isValidProCode(code: string) {
  const c = normalizeCode(code);
  return VALID_PRO_CODES.map((x) => normalizeCode(x)).includes(c);
}

export function PaywallScreen({ navigation, route }: any) {
  const { tokens } = useSectionTheme();

  const reason = String(route?.params?.reason ?? "").trim(); // optional: "Simulationen" / "Drills" / ...

  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [isPro, setIsPro] = useState(false);

  // ✅ Demo Meta (5 Sims free etc.)
  const [demoLimit, setDemoLimit] = useState(5);
  const [demoUsed, setDemoUsed] = useState(0);
  const [demoLeft, setDemoLeft] = useState(5);

  // Preis-Text kann später zentralisiert werden
  const priceText = useMemo(() => {
    // später z.B.: "7,99€/Monat"
    return "Preis folgt (Beta)";
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const s = await loadAppSettings();
        const meta = await getDemoSimulationMeta();

        if (cancelled) return;

        setIsPro(!!(s as any)?.isPro);

        setDemoLimit(meta.limit);
        setDemoUsed(meta.used);
        setDemoLeft(meta.left);
      } catch {
        // fallback (niemals crashen)
        if (cancelled) return;
        setDemoLimit(5);
        setDemoUsed(0);
        setDemoLeft(5);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onUnlock = async () => {
    Keyboard.dismiss();
    const c = normalizeCode(codeInput);
    if (!c) {
      Alert.alert("Fehlt noch", "Bitte Code eingeben.");
      return;
    }
    if (!isValidProCode(c)) {
      Alert.alert("Ungültig", "Der Code ist nicht gültig. Prüfe Tippfehler (ohne Leerzeichen).");
      return;
    }

    setBusy(true);
    try {
      await saveAppSettings({ isPro: true } as any);
      setIsPro(true);
      setCodeInput("");
      Alert.alert("Pro aktiviert ✅", "Danke! Pro ist jetzt freigeschaltet.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => navigation.goBack();

  const demoChipText = useMemo(() => {
    if (isPro) return "✅ Pro aktiv";
    return `Demo: ${demoLeft}/${demoLimit} Simulationen frei`;
  }, [isPro, demoLeft, demoLimit]);

  const lockReasonLine = useMemo(() => {
    if (!reason) return "Mehr Übung. Mehr Feedback. Mehr Fortschritt.";
    return `Freischaltung erforderlich für: ${reason}`;
  }, [reason]);

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>VivaMed Pro</Text>
            <Text style={styles.subtitle}>{lockReasonLine}</Text>
          </View>
          <VButton title="Zurück" variant="ghost" onPress={goBack} style={styles.headerGhost} />
        </View>

        {/* Hero */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Chip text={demoChipText} tone="soft" selected={isPro} />
              <Chip text={`Abo: ${priceText}`} tone="soft" />
              <Chip text="Jederzeit kündbar" tone="soft" />
            </View>

            {!isPro ? (
              <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.05), borderColor: rgba(tokens.tint, 0.14) }]}>
                <Text style={styles.smallHint}>
                  Du hast bereits <Text style={{ fontWeight: "900", color: colors.text }}>{demoUsed}</Text> von{" "}
                  <Text style={{ fontWeight: "900", color: colors.text }}>{demoLimit}</Text> kostenlosen Simulationen genutzt.
                  <Text style={{ fontWeight: "900", color: colors.text }}> {demoLeft}</Text> sind noch frei.
                </Text>
              </View>
            ) : null}

            <Text style={[styles.h2, { marginTop: 12 }]}>Was du mit Pro bekommst</Text>

            <View style={{ gap: 8, marginTop: 10 }}>
              <Text style={styles.item}>• Unbegrenzte Simulationen (prüfungsnah)</Text>
              <Text style={styles.item}>• Alle Drills + Wiederholungen</Text>
              <Text style={styles.item}>• KI-Coach Feedback (wenn Server aktiv)</Text>
              <Text style={styles.item}>• Fortschritt & Streaks (Motivation)</Text>
            </View>

            {!isPro ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.smallHint}>Beta-Freischaltung: Pro-Code eingeben</Text>

                <TextInput
                  value={codeInput}
                  onChangeText={setCodeInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="VM-XXXX-XXXX"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.06) }]}
                  returnKeyType="done"
                  onSubmitEditing={onUnlock}
                />

                <VButton
                  title={busy ? "Bitte warten…" : "Pro freischalten"}
                  variant="cta"
                  onPress={onUnlock}
                  disabled={busy}
                  style={{ marginTop: 10 }}
                />

                <Text style={[styles.smallHint, { marginTop: 10 }]}>
                  Hinweis: Später wird das hier auf ein echtes In-App Abo umgestellt (Apple/Google).
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <VButton title="Alles klar → Zurück" variant="cta" onPress={goBack} />
              </View>
            )}
          </Card>
        </View>

        {/* Footer info */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Warum Abo?</Text>
            <Text style={styles.smallHint}>
              Weil laufend neue Fälle, Drills und Verbesserungen dazukommen. Außerdem kostet KI/Server im Betrieb Geld.
            </Text>
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

  h2: { color: colors.text, fontWeight: "900", fontSize: 16 },
  item: { color: colors.text, fontWeight: "800", lineHeight: 18 },

  note: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    fontWeight: "800",
    marginTop: 10,
  },

  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 6 },
});
