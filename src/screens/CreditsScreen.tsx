import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, Linking } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { VButton } from "../components/VButton";
import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import { CREDITS_SECTIONS } from "../logic/credits";

async function openUrl(url: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) throw new Error("cannot open");
    await Linking.openURL(url);
  } catch {
    Alert.alert("Link konnte nicht geöffnet werden", url);
  }
}

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const { tokens } = useSectionTheme();
  return (
    <Pressable
      onPress={() => openUrl(url)}
      style={({ pressed }) => [
        styles.linkRow,
        { borderColor: rgba(tokens.tint, 0.16), backgroundColor: rgba(tokens.tint, 0.08) },
        pressed ? { opacity: 0.82 } : null,
      ]}
    >
      <Text style={[styles.linkText, { color: tokens.tint }]} numberOfLines={1}>
        ↗ {label}
      </Text>
      <Text style={styles.linkUrl} numberOfLines={1}>
        {url}
      </Text>
    </Pressable>
  );
}

export function CreditsScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  return (
    <ThemedScreen section="settings" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Credits & Lizenzen</Text>
            <Text style={styles.subtitle}>Quellen, Lizenzen und Hinweise (vor Release final prüfen).</Text>
          </View>
          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* Disclaimer */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.h2}>Educational Disclaimer</Text>
            <Text style={styles.body}>
              VivaMed ist ein Lern- und Trainingsprodukt. Es ersetzt keine medizinische Beratung, Diagnostik oder Therapie
              und ist nicht für den klinischen Einsatz gedacht.
            </Text>

            <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) }]}>
              <Text style={styles.noteText}>
                Tipp: Für Stores/Review später einen kurzen „Medical Disclaimer“-Text separat in den Settings anzeigen.
              </Text>
            </View>
          </Card>
        </View>

        {/* Privacy */}
        <View style={styles.block}>
          <Card padding="lg">
            <Text style={styles.h2}>Datenschutz (Kurzfassung)</Text>
            <Text style={styles.body}>
              Sessions/Drills/Pläne werden lokal auf deinem Gerät gespeichert. Du kannst Fortschritt jederzeit zurücksetzen
              (z.B. im Fortschritt-Screen). Cloud/Accounts sind aktuell nicht nötig.
            </Text>

            <View style={[styles.note, { backgroundColor: rgba(tokens.tint, 0.06), borderColor: rgba(tokens.tint, 0.14) }]}>
              <Text style={styles.noteText}>
                Hinweis: Wenn du später Sync/Accounts einbaust, brauchst du eine echte Datenschutzerklärung + Impressum.
              </Text>
            </View>
          </Card>
        </View>

        {/* Credits sections */}
        {CREDITS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.block}>
            <Card padding="lg">
              <Text style={styles.h2}>{section.title}</Text>

              {section.items.map((item, idx) => (
                <View
                  key={item.title}
                  style={[
                    styles.itemWrap,
                    idx === 0 ? { marginTop: 8 } : { marginTop: 12 },
                    {
                      borderColor: rgba(tokens.tint, 0.14),
                      backgroundColor: "#FFFFFF",
                    },
                  ]}
                >
                  <Text style={styles.itemTitle}>{item.title}</Text>

                  <View style={[styles.metaRow, { borderTopColor: rgba(tokens.tint, 0.10) }]}>
                    <Text style={styles.meta}>Lizenz: {item.license}</Text>
                  </View>

                  <Text style={styles.body}>{item.attribution}</Text>

                  {item.notes ? <Text style={styles.noteSmall}>{item.notes}</Text> : null}

                  {item.links?.length ? (
                    <View style={{ marginTop: 10, gap: 10 }}>
                      {item.links.map((l) => (
                        <LinkRow key={l.url} label={l.label} url={l.url} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        ))}

        <View style={styles.block}>
          <VButton title="Zurück" variant="outline" onPress={() => navigation.goBack()} />
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

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  body: { color: colors.textMuted, lineHeight: 18, fontWeight: "800" },

  note: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { color: colors.textMuted, fontWeight: "800", lineHeight: 16, fontSize: 12 },

  itemWrap: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12 },
  itemTitle: { color: colors.text, fontWeight: "900" },

  metaRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  meta: { color: colors.textMuted, fontWeight: "900" },

  noteSmall: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 16, fontWeight: "800" },

  linkRow: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  linkText: { fontWeight: "900" },
  linkUrl: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: "700" },
});
