// src/components/SelectField.tsx

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

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

export function SelectField({
  label,
  value,
  onChange,
  items,
  hint,
  disabled,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { label: string; value: string }[];
  hint?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { tokens } = useSectionTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const v = value ?? "";
    return items.find((it) => String(it.value) === String(v)) ?? null;
  }, [items, value]);

  const showSearch = items.length >= 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || String(it.value).toLowerCase().includes(q)
    );
  }, [items, query]);

  const bg = disabled ? "#F8FAFC" : rgba(tokens.tint, 0.07);
  const border = disabled
    ? rgba((colors as any).border ?? "#E5E7EB", 0.85)
    : rgba(tokens.tint, 0.16);

  const openPicker = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  };

  const closePicker = () => setOpen(false);

  const pick = (v: string) => {
    try {
      onChange(String(v));
    } finally {
      setOpen(false);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>

      {/* "Field" */}
      <Pressable
        onPress={openPicker}
        disabled={!!disabled}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: bg, borderColor: border },
          disabled ? { opacity: 0.65 } : null,
          pressed && !disabled ? { opacity: 0.85 } : null,
        ]}
      >
        <Text
          style={[
            styles.valueText,
            !selected ? { color: colors.textMuted } : null,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : "Auswählen…"}
        </Text>

        <Text style={[styles.chevron, { color: disabled ? colors.textMuted : tokens.tint }]}>
          ▾
        </Text>
      </Pressable>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {/* Modal Picker */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closePicker} />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View style={[styles.sheet, { borderColor: rgba(tokens.tint, 0.16) }]}>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{label}</Text>
                  <Text style={styles.sheetSub}>Tippe zum Auswählen</Text>
                </View>

                <Pressable
                  onPress={closePicker}
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed ? { opacity: 0.8 } : null,
                  ]}
                >
                  <Text style={styles.closeBtnText}>Schließen</Text>
                </Pressable>
              </View>

              {showSearch ? (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Suchen…"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[
                    styles.search,
                    {
                      borderColor: rgba(tokens.tint, 0.16),
                      backgroundColor: rgba(tokens.tint, 0.06),
                    },
                  ]}
                />
              ) : null}

              <FlatList
                data={filtered}
                keyExtractor={(it, idx) => `${String(it.value)}_${idx}`}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                style={{ maxHeight: 520 }}
                renderItem={({ item }) => {
                  const isSel = String(item.value) === String(value ?? "");
                  return (
                    <Pressable
                      onPress={() => pick(item.value)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderColor: rgba(tokens.tint, 0.12),
                          backgroundColor: isSel ? rgba(tokens.tint, 0.10) : "#FFFFFF",
                        },
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                    >
                      <Text style={[styles.rowText, isSel ? { color: colors.text } : null]} numberOfLines={2}>
                        {item.label}
                      </Text>
                      {isSel ? <Text style={styles.check}>✓</Text> : <View style={{ width: 18 }} />}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Keine Treffer.</Text>
                  </View>
                }
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },

  label: { color: colors.textMuted, fontSize: 13, fontWeight: "900", marginBottom: 6 },

  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "700" },

  box: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },

  valueText: {
    flex: 1,
    color: colors.text,
    fontWeight: "800",
  },

  chevron: { fontSize: 14, fontWeight: "900" },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },

  sheetWrap: { width: "100%" },
  sheet: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  sheetTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  sheetSub: { color: colors.textMuted, fontWeight: "800", fontSize: 12, marginTop: 4 },

  closeBtn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  closeBtnText: { color: colors.text, fontWeight: "900", fontSize: 12 },

  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontWeight: "700",
    marginBottom: 10,
  },

  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rowText: { color: colors.textMuted, fontWeight: "900", flex: 1, paddingRight: 10 },
  check: { color: colors.text, fontWeight: "900", fontSize: 16 },

  empty: { paddingVertical: 18, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontWeight: "800" },
});
