import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, Pressable } from "react-native";
import Slider from "@react-native-community/slider";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { SelectField } from "../components/SelectField";
import { Chip } from "../components/Chip";
import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { loadAppSettings, saveAppSettings, parseDateInputToMs, computeDaysLeftSimple } from "../logic/appSettings";

// ✅ zentral
import { FACHRICHTUNGEN, INNERE_SUBFAECHER } from "../logic/fachrichtungen";

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function OnboardingScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  const fachrichtungen = useMemo(() => FACHRICHTUNGEN, []);
  const innereSubfaecher = useMemo(() => INNERE_SUBFAECHER, []);

  const [step, setStep] = useState(0);

  const [fachrichtung, setFachrichtung] = useState(fachrichtungen[0]?.value ?? "Innere Medizin");
  const [innereOpen, setInnereOpen] = useState(false);
  const [innereSubfach, setInnereSubfach] = useState("");

  const [mode, setMode] = useState<"text" | "voice">("text");
  const [dailyMinutes, setDailyMinutes] = useState(10);

  const [examDateStr, setExamDateStr] = useState("");
  const [examDateMs, setExamDateMs] = useState<number | null>(null);

  useEffect(() => {
    loadAppSettings()
      .then((s) => {
        if (s.preferredFachrichtung) setFachrichtung(s.preferredFachrichtung);
        if (typeof s.preferredInnereSubfach === "string") setInnereSubfach(s.preferredInnereSubfach);
        if (s.preferredMode) setMode(s.preferredMode);
        if (typeof s.dailyMinutes === "number") setDailyMinutes(s.dailyMinutes);
        if (typeof s.examDateMs === "number") {
          const d = new Date(s.examDateMs);
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          setExamDateStr(`${dd}.${mm}.${yyyy}`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ms = parseDateInputToMs(examDateStr);
    setExamDateMs(ms);
  }, [examDateStr]);

  // Wenn nicht Innere gewählt: Unterfach-UI zurücksetzen
  useEffect(() => {
    if (fachrichtung !== "Innere Medizin") {
      setInnereOpen(false);
      setInnereSubfach("");
    }
  }, [fachrichtung]);

  const daysLeft = computeDaysLeftSimple(examDateMs);

  const next = () => {
    if (step === 1) {
      const trimmed = examDateStr.trim();
      if (trimmed.length > 0 && examDateMs === null) {
        Alert.alert("Datum nicht erkannt", "Bitte nutze dd.mm.yyyy (z.B. 15.03.2026) oder lass es leer.");
        return;
      }
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const buildSavePatch = () => ({
    onboardingDone: true,
    preferredFachrichtung: fachrichtung,
    preferredInnereSubfach: fachrichtung === "Innere Medizin" ? innereSubfach : "",
    preferredMode: mode,
    dailyMinutes,
    examDateMs: examDateMs ?? null,
  });

  const finish = async () => {
    try {
      await saveAppSettings(buildSavePatch());
    } catch {}
    navigation.replace("Home");
  };

  const skip = async () => {
    try {
      await saveAppSettings(buildSavePatch());
    } catch {}
    navigation.replace("Home");
  };

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Willkommen bei VivaMed</Text>
          <Text style={styles.subtitle}>45 Sekunden Setup – danach geht’s sofort los.</Text>
        </View>

        <Card accent padding="lg">
          <Text style={styles.overline}>Setup</Text>

          <View style={styles.stepRow}>
            <Chip text="1/3" selected={step === 0} tone="soft" />
            <Chip text="2/3" selected={step === 1} tone="soft" />
            <Chip text="3/3" selected={step === 2} tone="soft" />
          </View>

          {step === 0 ? (
            <>
              <Text style={styles.h2}>1) Welche Fachrichtung lernst du heute?</Text>

              <SelectField label="Fachrichtung" value={fachrichtung} onChange={setFachrichtung} items={fachrichtungen} />

              {fachrichtung === "Innere Medizin" ? (
                <View style={{ marginTop: 10 }}>
                  <Pressable
                    onPress={() => setInnereOpen((o) => !o)}
                    style={[
                      styles.collHeader,
                      { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.06) },
                    ]}
                  >
                    <Text style={styles.collTitle}>Innere-Unterfächer wählen</Text>
                    <Text style={styles.collChevron}>{innereOpen ? "▲" : "▼"}</Text>
                  </Pressable>

                  {innereOpen ? (
                    <View style={{ marginTop: 10 }}>
                      <SelectField
                        label="Unterfach (optional)"
                        value={innereSubfach}
                        onChange={(v) => setInnereSubfach(String(v ?? ""))}
                        items={innereSubfaecher}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.softPanel, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
                <Text style={styles.hint}>Du kannst das später jederzeit ändern – hier setzen wir nur einen guten Start.</Text>
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.h2}>2) Wann ist deine Prüfung? (optional)</Text>
              <Text style={styles.label}>Prüfungsdatum (dd.mm.yyyy)</Text>
              <TextInput
                value={examDateStr}
                onChangeText={setExamDateStr}
                placeholder="z.B. 15.03.2026"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.06) },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={{ marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Chip text={daysLeft === null ? "Tage bis Prüfung: —" : `Tage bis Prüfung: ${daysLeft}`} tone="soft" />
                <Chip text="Später im Plan änderbar" tone="muted" />
              </View>

              <View style={[styles.softPanel, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
                <Text style={styles.hint}>Leer lassen ist okay. Dann setzt du das Datum später im Plan-Screen.</Text>
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.h2}>3) Wie willst du üben?</Text>

              <SelectField
                label="Antwortmodus"
                value={mode}
                onChange={(v) => setMode(v as any)}
                items={[
                  { label: "Schriftlich", value: "text" },
                  { label: "Mündlich (Prüfer spricht)", value: "voice" },
                ]}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Tagesbudget: {Math.round(dailyMinutes)} Minuten</Text>
              <Slider
                minimumValue={5}
                maximumValue={60}
                value={dailyMinutes}
                onValueChange={setDailyMinutes}
                minimumTrackTintColor={(colors as any).primary ?? tokens.tint}
                maximumTrackTintColor={colors.border}
                thumbTintColor={(colors as any).primary ?? tokens.tint}
              />

              <View style={[styles.softPanel, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
                <Text style={styles.hint}>Wir nutzen das später für Coach & Plan. Fürs MVP reicht: Setup speichern → loslegen.</Text>
              </View>
            </>
          ) : null}

          <View style={{ marginTop: 14 }}>
            {step < 2 ? <VButton title="Weiter" variant="cta" onPress={next} /> : <VButton title="Fertig – loslegen" variant="cta" onPress={finish} />}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <VButton title="Zurück" variant="outline" onPress={back} />
              </View>
              <View style={{ flex: 1 }}>
                <VButton title="Überspringen" variant="ghost" onPress={skip} />
              </View>
            </View>
          </View>
        </Card>
      </View>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 44 },

  header: { marginBottom: 10 },
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  overline: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },

  stepRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 14, marginBottom: 10 },

  label: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginTop: 6, marginBottom: 6 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontWeight: "700",
  },

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
