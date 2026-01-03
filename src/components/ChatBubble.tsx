import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

type Role = "examiner" | "student" | "system";

type Props = {
  role: Role;
  text: string;
};

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ChatBubble({ role, text }: Props) {
  const { tokens } = useSectionTheme();
  const border = (tokens as any)?.border ?? colors.border;

  const isStudent = role === "student";
  const isSystem = role === "system";

  const rowStyle = isSystem ? styles.centerRow : isStudent ? styles.rightRow : styles.leftRow;

  const bubbleStyle = isSystem
    ? [
        styles.bubble,
        styles.systemBubble,
        { borderColor: rgba(tokens.tint, 0.14), backgroundColor: rgba(tokens.tint, 0.06) },
      ]
    : isStudent
    ? [
        styles.bubble,
        styles.studentBubble,
        { backgroundColor: rgba(tokens.tint, 0.92), borderColor: rgba(tokens.tint, 0.35) },
      ]
    : [
        styles.bubble,
        styles.examinerBubble,
        { borderColor: rgba(tokens.tint, 0.12), backgroundColor: "#FFFFFF" },
      ];

  const metaText = isSystem ? null : isStudent ? "Du" : "Prüfer";

  return (
    <View style={[styles.row, rowStyle]}>
      <View style={bubbleStyle}>
        {metaText ? (
          <Text style={[styles.meta, isStudent ? styles.metaOnTint : styles.metaMuted]}>{metaText}</Text>
        ) : null}

        <Text style={[styles.text, isStudent ? styles.textOnTint : null, isSystem ? styles.textSystem : null]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 10, flexDirection: "row" },
  leftRow: { justifyContent: "flex-start" },
  rightRow: { justifyContent: "flex-end" },
  centerRow: { justifyContent: "center" },

  bubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },

  // Examiner: clean white, subtle shadow
  examinerBubble: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 1,
  },

  // Student: tinted fill
  studentBubble: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 1,
  },

  // System: quiet, centered
  systemBubble: {},

  meta: { fontSize: 11, fontWeight: "900", marginBottom: 6 },
  metaMuted: { color: colors.textMuted },
  metaOnTint: { color: "rgba(255,255,255,0.88)" },

  text: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  textOnTint: { color: "#FFFFFF", fontWeight: "700" },
  textSystem: { color: colors.textMuted, textAlign: "center", fontWeight: "800" },
});
