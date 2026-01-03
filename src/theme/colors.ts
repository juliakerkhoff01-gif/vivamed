export const colors = {
  // Base
  background: "#F7FAFC",
  surface: "#FFFFFF",
  surface2: "#F1F5F9",

  // Brand
  primary: "#0F766E",
  primaryDark: "#115E59",

  // CTA
  cta: "#F59E0B",
  ctaDark: "#B45309",

  // Text
  text: "#0F172A",
  textMuted: "#475569",

  // UI
  border: "#E2E8F0",
  overlay: "rgba(15, 23, 42, 0.06)",

  // Status
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
} as const;

export type ColorKey = keyof typeof colors;
