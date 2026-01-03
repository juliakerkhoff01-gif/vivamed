import { Platform } from "react-native";

const base = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

export const typography = {
  font: base,
  title: { fontFamily: base, fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  subtitle: { fontFamily: base, fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontFamily: base, fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  muted: { fontFamily: base, fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
};
