import React, { useMemo } from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View } from "react-native";
import { colors } from "../theme/colors";
import { useSectionTheme } from "../theme/SectionThemeContext";

type Variant = "cta" | "outline" | "ghost";

type Props = {
  title: string;
  onPress?: () => void | Promise<void>;
  variant?: Variant;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;

  /** optional: kleines Icon links (Emoji reicht völlig) */
  leftIcon?: string;
};

function rgba(hex: string, alpha: number) {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function VButton({ title, onPress, variant = "cta", style, disabled, leftIcon }: Props) {
  const { tokens } = useSectionTheme();

  const isCTA = variant === "cta";
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";

  // CTA-Farbe: erst global theme primary, sonst Section Tint
  const ctaColor = (colors as any).cta ?? (colors as any).primary ?? tokens.tint;

  const containerStyle: any[] = [
    styles.base,
    isCTA && [styles.cta, { backgroundColor: ctaColor, borderColor: ctaColor }],
    isOutline && [
      styles.outline,
      { borderColor: rgba(tokens.tint, 0.18), backgroundColor: rgba(tokens.tint, 0.08) },
    ],
    isGhost && styles.ghost,
    style,
  ].filter(Boolean);

  const textStyle: TextStyle[] = [
    styles.textBase,
    isCTA ? styles.textCTA : { color: tokens.tint },
    disabled ? styles.textDisabled : null,
  ].filter(Boolean) as any;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        containerStyle,
        pressed && !disabled
          ? isCTA
            ? styles.pressedCTA
            : styles.pressed
          : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.row}>
        {leftIcon ? (
          <Text style={[styles.icon, isCTA ? { color: "#FFFFFF" } : { color: tokens.tint }]}>{leftIcon}</Text>
        ) : null}
        <Text style={textStyle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },

  // CTA: „Primary“
  cta: {
    // colors come from component
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },

  // Outline: soft secondary
  outline: {},

  // Ghost: link-like
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 40,
  },

  textBase: { fontWeight: "900", fontSize: 14 },
  textCTA: { color: "#FFFFFF" },

  icon: { fontSize: 14, fontWeight: "900" },

  pressed: { opacity: 0.86 },
  pressedCTA: { opacity: 0.92 },

  disabled: { opacity: 0.55 },
  textDisabled: { opacity: 0.95 },
});
