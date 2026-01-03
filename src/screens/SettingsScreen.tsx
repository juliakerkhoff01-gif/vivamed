// src/screens/SettingsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, Keyboard } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { Chip } from "../components/Chip";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { loadAppSettings, saveAppSettings, pingServerHealth } from "../logic/appSettings";

/**
 * ✅ V1 Pro-Codes (offline)
 */
const VALID_PRO_CODES = ["VM-DEMO-2026", "VM-9K2F-R7Q1", "VM-4T8A-H2WZ"];

// ✅ Production default (Render) – kommt aus .env
const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://vivamed.onrender.com").replace(/\/+$/, "");

/** Normalize a base URL string to "http(s)://host:port" without trailing slash */
function normalizeBaseUrl(input: any): string {
  let s = String(input ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  s = s.replace(/\/+$/, "");
  if (s.includes("DEINE_MAC_IP")) return "";
  return s;
}

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

async function fetchHealthDetails(url: string): Promise<{ ok: boolean; service?: string; time?: string }> {
  const u = normalizeBaseUrl(url);
  if (!u) return { ok: false };

  try {
    const r = await fetch(`${u}/health`, { method: "GET" });
    if (!r.ok) return { ok: false };
    const j: any = await r.json().catch(() => ({}));
    return { ok: j?.ok === true, service: j?.service, time: j?.time };
  } catch {
    return { ok: false };
  }
}

export function SettingsScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [savedBaseUrl, setSavedBaseUrl] = useState("");
  const [health, setHealth] = useState<null | boolean>(null);
  const [healthDetails, setHealthDetails] = useState<{ service?: string; time?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Pro status
  const [isPro, setIsPro] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  const normalizedInput = useMemo(() => normalizeBaseUrl(baseUrlInput), [baseUrlInput]);

  const isDirty = useMemo(
    () => normalizeBaseUrl(baseUrlInput) !== normalizeBaseUrl(savedBaseUrl),
    [baseUrlInput, savedBaseUrl]
  );

  const effectiveUrl = useMemo(() => {
    // UI status should show what will be used: saved → input → default
    return normalizeBaseUrl(savedBaseUrl) || normalizeBaseUrl(baseUrlInput) || DEFAULT_API_URL;
  }, [savedBaseUrl, baseUrlInput]);

  const chipText = useMemo(() => {
    const url = effectiveUrl;
    if (!url) return "Server: keine URL gesetzt";
    if (health === null) return `Server: ? (${url})`;
    return health ? `Server: OK (${url})` : `Server: Fehler (${url})`;
  }, [effectiveUrl, health]);

  const refresh = async () => {
    const s = await loadAppSettings();
    const urlFromSettings = normalizeBaseUrl((s as any)?.aiBaseUrl);

    // ✅ Wenn noch nie etwas gespeichert wurde: Default (Render) nehmen
    const url = urlFromSettings || DEFAULT_API_URL;

    setSavedBaseUrl(urlFromSettings); // saved = nur das, was wirklich gespeichert ist
    setBaseUrlInput(url); // input = das, was wir anzeigen/bearbeiten
    setHealth(null);
    setHealthDetails(null);

    setIsPro(!!(s as any)?.isPro);
  };

  useEffect(() => {
    const unsub = navigation?.addListener?.("focus", refresh);
    refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const onSave = async () => {
    Keyboard.dismiss();
    const url = normalizeBaseUrl(baseUrlInput);

    if (!url) {
      Alert.alert("Fehlt noch", `Bitte eine Server-URL eintragen.\n\nBeispiel: ${DEFAULT_API_URL}`);
      return;
    }

    if (url.includes("localhost")) {
      Alert.alert(
        "Hinweis",
        "localhost funktioniert nur auf dem Simulator/Mac. Auf dem iPhone bitte eine echte IP oder eine Online-URL nutzen."
      );
    }

    setBusy(true);
    try {
      const next = await saveAppSettings({ aiBaseUrl: url } as any);
      const saved = normalizeBaseUrl((next as any)?.aiBaseUrl);
      setSavedBaseUrl(saved);
      setHealth(null);
      setHealthDetails(null);
      Alert.alert("Gespeichert", `Server-URL ist jetzt:\n${saved}`);
    } catch (e: any) {
      Alert.alert("Fehler beim Speichern", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onTest = async (mode: "input" | "saved" | "effective") => {
    Keyboard.dismiss();

    const url =
      mode === "saved"
        ? normalizeBaseUrl(savedBaseUrl)
        : mode === "input"
        ? normalizeBaseUrl(baseUrlInput)
        : effectiveUrl;

    if (!url) {
      setHealth(false);
      setHealthDetails(null);
      Alert.alert("Fehlt noch", "Bitte zuerst eine Server-URL eintragen.");
      return;
    }

    setBusy(true);
    setHealth(null);
    setHealthDetails(null);

    try {
      const ok = await pingServerHealth(url);
      setHealth(ok);

      const details = await fetchHealthDetails(url);
      if (details.ok) setHealthDetails({ service: details.service, time: details.time });

      Alert.alert(
        ok ? "Verbindung OK ✅" : "Keine Verbindung ❌",
        ok
          ? `Der Server antwortet auf /health.${details?.service ? `\nService: ${details.service}` : ""}`
          : `Prüfe URL/Internet.\nTipp: Öffne am Handy im Browser:\n${url}/health`
      );
    } finally {
      setBusy(false);
    }
  };

  const onFillExample = () => {
    setBaseUrlInput("http://192.168.178.25:8788");
    setHealth(null);
    setHealthDetails(null);
  };

  const onFillLocalhost = () => {
    // ✅ wirklich localhost – nur für Simulator/Mac (du nutzt lokal 8788)
    setBaseUrlInput("http://localhost:8788");
    setHealth(null);
    setHealthDetails(null);
  };

  const onFillDefault = () => {
    setBaseUrlInput(DEFAULT_API_URL);
    setHealth(null);
    setHealthDetails(null);
  };

  const onResetToSaved = () => {
    // wenn kein saved vorhanden: zurück zu Default
    setBaseUrlInput(normalizeBaseUrl(savedBaseUrl) || DEFAULT_API_URL);
    setHealth(null);
    setHealthDetails(null);
  };

  const onUnlockPro = async () => {
    Keyboard.dismiss();
    const c = normalizeCode(codeInput);

    if (!c) {
      Alert.alert("Fehlt noch", "Bitte Pro-Code eingeben.");
      return;
    }

    if (!isValidProCode(c)) {
      Alert.alert("Code ungültig", "Dieser Code ist leider nicht gültig. Prüfe Tippfehler (ohne Leerzeichen).");
      return;
    }

    setBusy(true);
    try {
      await saveAppSettings({ isPro: true } as any);
      setIsPro(true);
      setCodeInput("");
      Alert.alert("Pro aktiviert ✅", "Danke! Pro ist jetzt freigeschaltet.");
    } catch (e: any) {
      Alert.alert("Fehler", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onResetPro = async () => {
    setBusy(true);
    try {
      await saveAppSettings({ isPro: false, demoSimUsed: false, demoDrillUsed: false } as any);
      setIsPro(false);
      Alert.alert("Zurückgesetzt", "Pro deaktiviert + Demo zurückgesetzt.");
    } finally {
      setBusy(false);
    }
  };

  const tintBorder = rgba(tokens.tint, 0.18);
  const tintBg = rgba(tokens.tint, 0.06);

  return (
    <ThemedScreen section="home" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Einstellungen</Text>
            <Text style={styles.subtitle}>Server & Pro-Freischaltung</Text>
          </View>

          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* PRO */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Pro</Text>

            <View style={{ marginTop: 8 }}>
              <Chip text={isPro ? "✅ Pro aktiv" : "🔒 Pro nicht aktiv (Demo-Modus)"} tone="soft" selected={isPro} />
            </View>

            {!isPro ? (
              <>
                <Text style={[styles.smallHint, { marginTop: 10 }]}>
                  Du hast einen Pro-Code? Gib ihn hier ein. (Ohne Leerzeichen)
                </Text>

                <TextInput
                  value={codeInput}
                  onChangeText={setCodeInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="VM-XXXX-XXXX"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { borderColor: tintBorder, backgroundColor: tintBg, marginTop: 10 }]}
                  returnKeyType="done"
                  onSubmitEditing={onUnlockPro}
                />

                <View style={{ marginTop: 10 }}>
                  <VButton title={busy ? "Bitte warten…" : "Pro freischalten"} variant="cta" onPress={onUnlockPro} disabled={busy} />
                </View>
              </>
            ) : (
              <Text style={[styles.smallHint, { marginTop: 10 }]}>
                Pro ist aktiv. Simulationen und Drills sind unbegrenzt verfügbar.
              </Text>
            )}

            <View style={{ marginTop: 10 }}>
              <VButton
                title={busy ? "Bitte warten…" : "Pro/Demo zurücksetzen (nur Test)"}
                variant="ghost"
                onPress={onResetPro}
                disabled={busy}
              />
            </View>
          </Card>
        </View>

        {/* Status */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Server Status</Text>

            <View style={{ marginTop: 8 }}>
              <Chip text={chipText} tone="soft" />
            </View>

            {health && healthDetails?.service ? (
              <Text style={[styles.smallHint, { marginTop: 8 }]}>
                Health: {healthDetails.service}
                {healthDetails.time ? ` • ${healthDetails.time}` : ""}
              </Text>
            ) : null}

            <View style={{ marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {isDirty ? <Chip text="Nicht gespeichert" tone="soft" /> : <Chip text="Gespeichert" selected tone="soft" />}
              {savedBaseUrl ? <Chip text="Quelle: AppSettings" tone="soft" /> : <Chip text="Quelle: Default (ENV)" tone="soft" />}
            </View>

            <Text style={styles.smallHint}>
              Für echte Nutzer:innen: nutze immer die Online-URL (Render). Lokal brauchst du IP/localhost nur zum Testen.
            </Text>
          </Card>
        </View>

        {/* Server */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Server</Text>

            <Text style={styles.fieldLabel}>AI Server Base URL</Text>
            <TextInput
              value={baseUrlInput}
              onChangeText={(t) => {
                setBaseUrlInput(t);
                setHealth(null);
                setHealthDetails(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={DEFAULT_API_URL}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: tintBorder, backgroundColor: tintBg }]}
              returnKeyType="done"
              onSubmitEditing={onSave}
            />

            <View style={[styles.preview, { borderColor: rgba(tokens.tint, 0.14), backgroundColor: rgba(tokens.tint, 0.04) }]}>
              <Text style={styles.previewLabel}>Normalisiert:</Text>
              <Text style={styles.previewValue}>{normalizedInput || "—"}</Text>
            </View>

            <View style={{ marginTop: 10, gap: 10 }}>
              <VButton title={busy ? "Bitte warten…" : "Speichern"} variant="cta" onPress={onSave} disabled={busy} />

              <VButton
                title={busy ? "Bitte warten…" : "Verbindung testen (effektiv) → /health"}
                variant="outline"
                onPress={() => onTest("effective")}
                disabled={busy}
              />

              <VButton
                title={busy ? "Bitte warten…" : "Verbindung testen (Eingabe) → /health"}
                variant="outline"
                onPress={() => onTest("input")}
                disabled={busy}
              />

              <VButton
                title={busy ? "Bitte warten…" : "Verbindung testen (gespeichert) → /health"}
                variant="outline"
                onPress={() => onTest("saved")}
                disabled={busy}
              />

              {isDirty ? <VButton title="Änderungen verwerfen" variant="ghost" onPress={onResetToSaved} /> : null}

              <VButton title="Default (Render) einfügen" variant="ghost" onPress={onFillDefault} />
              <VButton title="Beispiel-IP einfügen (LAN Test)" variant="ghost" onPress={onFillExample} />
              <VButton title="localhost einfügen (nur Simulator/Mac)" variant="ghost" onPress={onFillLocalhost} />
            </View>

            <Text style={styles.smallHint}>
              Tipp: Wenn dein iPhone lokal nicht rankommt, liegt es fast immer an: WLAN unterschiedlich, Firewall, falsche IP oder Server läuft nicht.
              Für echte Nutzer:innen nimm immer die Online-URL (Render).
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

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900", marginTop: 10, marginBottom: 6 },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    fontWeight: "800",
  },

  preview: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  previewValue: { color: colors.text, fontWeight: "900", marginTop: 6 },

  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 10 },
});
