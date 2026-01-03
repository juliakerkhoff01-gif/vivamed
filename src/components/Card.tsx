import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
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

export function Card({
  children,
  style,
  accent,
  padding = "md",
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Optional: dünne Akzentlinie oben (Section-Tint) */
  accent?: boolean;
  /** Optional: einheitliche Innenabstände */
  padding?: "sm" | "md" | "lg";
}) {
  const { tokens } = useSectionTheme();

  const padStyle = padding === "sm" ? styles.padSm : padding === "lg" ? styles.padLg : styles.padMd;

  // ruhigere Border: weniger „Kasten“, mehr „Surface“
  const border = rgba((colors as any).border ?? "#E5E7EB", 0.7);

  return (
    <View
      style={[
        styles.card,
        { borderColor: border },
        accent ? [styles.cardAccent, { borderTopColor: rgba(tokens.tint, 0.55) }] : null,
        padStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,

    borderWidth: 1,

    // Premium Shadow: weicher, größer, aber subtil
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },

  // Optional: Akzentkante oben (sehr „Produkt“)
  cardAccent: {
    borderTopWidth: 3,
  },

  padSm: { padding: 12 },
  padMd: { padding: 16 },
  padLg: { padding: 20 },
});
