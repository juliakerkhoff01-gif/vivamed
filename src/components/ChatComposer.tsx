import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "../theme";
import { useSectionTheme } from "../theme/SectionThemeContext";

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type Props = {
  placeholder?: string;
  onSend: (text: string) => void;
  disabled?: boolean;

  value?: string;
  onChangeText?: (text: string) => void;

  // NEU: optionaler Slot über dem Input (z.B. Buttons)
  topSlot?: React.ReactNode;
};

export function ChatComposer({
  placeholder = "Antwort eingeben…",
  onSend,
  disabled,
  value,
  onChangeText,
  topSlot,
}: Props) {
  const { tokens } = useSectionTheme();
  const insets = useSafeAreaInsets();

  const [internal, setInternal] = useState("");

  const controlled = typeof value === "string" && typeof onChangeText === "function";
  const currentValue = controlled ? value : internal;

  const setValue = (v: string) => {
    if (controlled) onChangeText!(v);
    else setInternal(v);
  };

  const canSend = useMemo(() => !disabled && currentValue.trim().length > 0, [disabled, currentValue]);

  const send = () => {
    if (!canSend) return;
    const text = currentValue.trim();
    setValue("");
    onSend(text);
  };

  const surfaceBg = rgba(tokens.tint, 0.06);
  const surfaceBorder = rgba(tokens.tint, 0.16);
  const sendBg = canSend ? (colors.primary ?? tokens.tint) : rgba(tokens.tint, 0.18);
  const sendIcon = canSend ? "#FFFFFF" : colors.textMuted;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View
        style={[
          styles.wrap,
          {
            borderTopColor: rgba(tokens.tint, 0.10),
            paddingBottom: spacing.md + Math.max(0, insets.bottom),
          },
        ]}
      >
        {topSlot ? <View style={styles.topSlot}>{topSlot}</View> : null}

        <View style={[styles.surface, { borderColor: surfaceBorder, backgroundColor: surfaceBg, shadowColor: "#000" }]}>
          <TextInput
            value={currentValue}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoCapitalize="sentences"
            autoCorrect
          />

          <Pressable
            onPress={send}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: sendBg, borderColor: rgba(tokens.tint, canSend ? 0.18 : 0.10) },
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={[styles.sendIcon, { color: sendIcon }]}>➤</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Enter: neue Zeile · Senden: Pfeil</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
  },
  topSlot: {
    marginBottom: 8,
  },
  surface: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sendIcon: {
    fontWeight: "900",
    fontSize: 16,
    marginLeft: 2,
  },
  hint: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
});
