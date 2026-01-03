import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";

import { ThemedScreen } from "../components/ThemedScreen";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { VButton } from "../components/VButton";
import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

import {
  ROENTGEN_CASES,
  ROENTGEN_CATEGORIES,
  ROENTGEN_QUALITY_PATH,
  ROENTGEN_THORAX_PATH,
  ROENTGEN_SKELETON_PATH,
  RoentgenCase,
  RoentgenCategory,
  getRoentgenCaseById,
  pickRandomRoentgenCase,
} from "../logic/roentgenCases";

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type Tab = "collection" | "path";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function RoentgenTrainerScreen({ navigation }: any) {
  const { tokens } = useSectionTheme();

  const [tab, setTab] = useState<Tab>("collection");
  const [category, setCategory] = useState<RoentgenCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCase: RoentgenCase | null = useMemo(
    () => (selectedId ? getRoentgenCaseById(selectedId) : null),
    [selectedId]
  );

  const filtered = useMemo(() => {
    const base = category ? ROENTGEN_CASES.filter((c) => c.category === category) : ROENTGEN_CASES;
    return base;
  }, [category]);

  const onOpenRandom = () => {
    const c = pickRandomRoentgenCase(category);
    setSelectedId(c.id);
    setTab("collection");
  };

  const onNextRandom = () => {
    const c = pickRandomRoentgenCase(category);
    setSelectedId(c.id);
  };

  const categoryLabel = useMemo(() => {
    if (!category) return "Alle";
    return ROENTGEN_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  }, [category]);

  const topHint = selectedCase
    ? `Aktueller Fall: ${selectedCase.title}`
    : `Sammlung (${filtered.length}) · Kategorie: ${categoryLabel}`;

  return (
    <ThemedScreen section="trainer" style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Röntgen-Trainer</Text>
            <Text style={styles.subtitle}>V1: Kernfälle + Blickführung (RIPE + A–E / Skelett-Schema).</Text>
          </View>
          <VButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} style={styles.headerGhost} />
        </View>

        {/* Hero */}
        <View style={styles.block}>
          <Card accent padding="lg">
            <Text style={styles.overline}>Röntgen v1</Text>
            <Text style={styles.h1}>Schnell drillen: Systematik → Befundsatz → nächste Schritte</Text>

            <View style={{ marginTop: 14 }}>
              <VButton title="Neues Bild (random)" variant="cta" onPress={onOpenRandom} leftIcon="🎲" />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <VButton
                    title="Schema"
                    variant="outline"
                    onPress={() => {
                      setTab("path");
                      setSelectedId(null);
                    }}
                    leftIcon="🧭"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <VButton
                    title="Sammlung"
                    variant="outline"
                    onPress={() => {
                      setTab("collection");
                    }}
                    leftIcon="📚"
                  />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.softPanel,
                { backgroundColor: rgba(tokens.tint, 0.08), borderColor: rgba(tokens.tint, 0.16) },
              ]}
            >
              <Text style={styles.body}>
                Merksatz: erst <Text style={styles.strong}>RIPE</Text>, dann <Text style={styles.strong}>A–E</Text>. Am
                Ende: <Text style={styles.strong}>1 Satz Befund</Text> +{" "}
                <Text style={styles.strong}>1 Satz DDx</Text> + <Text style={styles.strong}>1 Satz nächster Schritt</Text>.
              </Text>
            </View>
          </Card>
        </View>

        {/* Mini Tabs */}
        <View style={styles.block}>
          <Card padding="lg">
            <View style={styles.rowBetween}>
              <Text style={styles.smallHint}>{topHint}</Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setTab("collection")} style={({ pressed }) => [pressed ? { opacity: 0.8 } : null]}>
                  <Text style={[styles.miniLink, tab === "collection" ? { color: tokens.tint } : null]}>Sammlung</Text>
                </Pressable>
                <Text style={styles.miniSep}>·</Text>
                <Pressable onPress={() => setTab("path")} style={({ pressed }) => [pressed ? { opacity: 0.8 } : null]}>
                  <Text style={[styles.miniLink, tab === "path" ? { color: tokens.tint } : null]}>Schema</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        </View>

        {/* Schema */}
        {tab === "path" ? (
          <View style={styles.block}>
            <Card padding="lg">
              <SectionTitle>Bildqualität</SectionTitle>
              {ROENTGEN_QUALITY_PATH.map((s) => (
                <View key={s.title} style={styles.pathBlock}>
                  <Text style={styles.pathTitle}>{s.title}</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {s.points.map((p) => (
                      <Text key={p} style={styles.pathItem}>
                        • {p}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}

              <SectionTitle>Thorax (A–E)</SectionTitle>
              {ROENTGEN_THORAX_PATH.map((s) => (
                <View key={s.title} style={styles.pathBlock}>
                  <Text style={styles.pathTitle}>{s.title}</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {s.points.map((p) => (
                      <Text key={p} style={styles.pathItem}>
                        • {p}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}

              <SectionTitle>Skelett</SectionTitle>
              {ROENTGEN_SKELETON_PATH.map((s) => (
                <View key={s.title} style={styles.pathBlock}>
                  <Text style={styles.pathTitle}>{s.title}</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {s.points.map((p) => (
                      <Text key={p} style={styles.pathItem}>
                        • {p}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}

              <View style={{ marginTop: 12 }}>
                <VButton title="Zur Sammlung" variant="outline" onPress={() => setTab("collection")} />
              </View>
            </Card>
          </View>
        ) : null}

        {/* Sammlung / Filter */}
        {tab === "collection" && !selectedCase ? (
          <View style={styles.block}>
            <Card padding="lg">
              <SectionTitle>Filter</SectionTitle>

              <View style={styles.chips}>
                <Chip text="Alle" selected={!category} onPress={() => setCategory(null)} />
                {ROENTGEN_CATEGORIES.map((c) => (
                  <Chip key={c.id} text={c.label} selected={category === c.id} onPress={() => setCategory(c.id)} />
                ))}
              </View>

              <View style={{ marginTop: 12 }}>
                <VButton title="Random aus Filter" variant="cta" onPress={onOpenRandom} leftIcon="🎲" />
              </View>
            </Card>
          </View>
        ) : null}

        {/* Sammlung: Liste */}
        {tab === "collection" && !selectedCase ? (
          <View style={styles.block}>
            <Card padding="lg">
              <SectionTitle>Kernfälle</SectionTitle>

              {filtered.map((c, idx) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedId(c.id)}
                  style={({ pressed }) => [
                    styles.caseRow,
                    idx === 0 ? { borderTopWidth: 0 } : null,
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={styles.caseTitle} numberOfLines={2}>
                        {c.title}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: rgba(tokens.tint, 0.10), borderColor: rgba(tokens.tint, 0.16) },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: tokens.tint }]}>{c.category}</Text>
                      </View>
                    </View>

                    <Text style={styles.casePrompt} numberOfLines={2}>
                      {c.prompt}
                    </Text>

                    <View style={styles.tagRow}>
                      {c.tags.slice(0, 3).map((t) => (
                        <View
                          key={t}
                          style={[
                            styles.tag,
                            { borderColor: rgba(tokens.tint, 0.14), backgroundColor: rgba(tokens.tint, 0.06) },
                          ]}
                        >
                          <Text style={styles.tagText} numberOfLines={1}>
                            {t}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.openHint, { color: tokens.tint }]}>Öffnen →</Text>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Detail */}
        {tab === "collection" && selectedCase ? (
          <View style={styles.block}>
            <Card padding="lg">
              <Text style={styles.overline}>Fall</Text>
              <Text style={styles.detailTitle}>{selectedCase.title}</Text>

              <View style={styles.chips}>
                <Chip text={selectedCase.category} selected />
                {selectedCase.tags.slice(0, 4).map((t) => (
                  <Chip key={t} text={t} tone="muted" />
                ))}
              </View>

              <View
                style={[
                  styles.softPanel,
                  { backgroundColor: rgba(tokens.tint, 0.06), borderColor: rgba(tokens.tint, 0.14) },
                ]}
              >
                <Text style={styles.body}>{selectedCase.prompt}</Text>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Was du finden/prüfen solltest</SectionTitle>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedCase.keyFindings.map((p) => (
                    <Text key={p} style={styles.item}>
                      • {p}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Musterbefund (prüfungsreif)</SectionTitle>
                <View style={[styles.quote, { borderColor: rgba(tokens.tint, 0.16), backgroundColor: "#FFFFFF" }]}>
                  <Text style={styles.quoteText}>{selectedCase.report}</Text>
                </View>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Differentialdiagnosen</SectionTitle>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedCase.differential.map((d) => (
                    <Text key={d} style={styles.item}>
                      • {d}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Nächste Schritte</SectionTitle>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedCase.nextSteps.map((n) => (
                    <Text key={n} style={styles.item}>
                      • {n}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Fallen</SectionTitle>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedCase.pitfalls.map((r) => (
                    <Text key={r} style={styles.item}>
                      • {r}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.detailBlock}>
                <SectionTitle>Prüfungsfragen</SectionTitle>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedCase.examQuestions.map((q) => (
                    <Text key={q} style={styles.item}>
                      • {q}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <VButton title="Nächstes Bild (random)" variant="cta" onPress={onNextRandom} leftIcon="🎲" />
                <VButton
                  title="Zurück zur Sammlung"
                  variant="outline"
                  onPress={() => setSelectedId(null)}
                  style={{ marginTop: 10 }}
                />
              </View>
            </Card>
          </View>
        ) : null}

        <View style={styles.block}>
          <VButton title="Trainer Hub" variant="ghost" onPress={() => navigation.navigate("TrainerHub")} />
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
  h1: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 },

  h2: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  body: { color: colors.textMuted, lineHeight: 18, fontWeight: "800" },
  strong: { color: colors.text, fontWeight: "900" },

  chips: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },

  softPanel: { marginTop: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  smallHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  miniLink: { color: colors.textMuted, fontWeight: "900" },
  miniSep: { color: colors.textMuted, fontWeight: "900" },

  caseRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  caseTitle: { color: colors.text, fontWeight: "900", flexShrink: 1 },
  casePrompt: { color: colors.textMuted, marginTop: 6, lineHeight: 16, fontWeight: "800" },

  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontWeight: "900", fontSize: 12 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },

  openHint: { fontWeight: "900", alignSelf: "center" },

  detailTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 6 },

  detailBlock: { marginTop: 14 },
  item: { color: colors.text, lineHeight: 20, fontWeight: "800" },

  quote: { marginTop: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  quoteText: { color: colors.text, lineHeight: 18, fontWeight: "800" },

  pathBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  pathTitle: { color: colors.text, fontWeight: "900" },
  pathItem: { color: colors.textMuted, fontWeight: "800", lineHeight: 18 },
});
