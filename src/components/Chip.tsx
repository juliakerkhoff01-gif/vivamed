import React from "react";
import { View, Text, StyleSheet, ViewStyle, Pressable, TextStyle } from "react-native";
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

type Props = {
  text: string;
  style?: ViewStyle;

  /** "soft" (default) oder "muted" */
  tone?: "soft" | "muted";

  /** Selected state → tinted background (Section-Farbe) */
  selected?: boolean;

  /** Optional klickbar */
  onPress?: () => void;

  /** Optional: kleines Icon vorne/hinten (Emoji ok) */
  leading?: string;
  trailing?: string;
};

export function Chip({
  text,
  style,
  tone = "soft",
  selected = false,
  onPress,
  leading,
  trailing,
}: Props) {
  const { tokens } = useSectionTheme();

  const baseBg = tone === "muted" ? "rgba(15, 23, 42, 0.03)" : "#FFFFFF";
  const bg = selected ? rgba(tokens.tint, 0.12) : baseBg;

  const border = selected ? rgba(tokens.tint, 0.22) : rgba((colors as any).border ?? "#E5E7EB", 0.9);

  const textColor = selected ? tokens.tint : (colors as any).textMuted ?? "#475569";
  const textWeight: TextStyle = selected ? { fontWeight: "900" } : { fontWeight: "900" };

  const inner = (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }, style]}>
      {leading ? <Text style={[styles.icon, { color: selected ? tokens.tint : (colors as any).textMuted }]}>{leading}</Text> : null}

      <Text style={[styles.text, { color: textColor }, textWeight]} numberOfLines={1}>
        {text}
      </Text>

      {trailing ? <Text style={[styles.icon, { color: selected ? tokens.tint : (colors as any).textMuted }]}>{trailing}</Text> : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pressed ? { opacity: 0.82, transform: [{ scale: 0.99 }] } : null,
      ]}
      hitSlop={6}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,

    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  text: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  icon: {
    fontSize: 12,
    fontWeight: "900",
  },
});
