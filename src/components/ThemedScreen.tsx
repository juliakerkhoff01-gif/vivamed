import React from "react";
import { View, StyleSheet } from "react-native";

import { Screen } from "./Screen";
import { SectionThemeProvider } from "../theme/SectionThemeContext";
import { AppSection, SECTION_THEMES } from "../theme/sectionTheme";

export function ThemedScreen({
  section,
  children,
  style,
  wash = true,
  washOpacity = 0.65,
}: {
  section: AppSection;
  children: React.ReactNode;
  style?: any;

  /** Pastell-Wash oben ein/aus */
  wash?: boolean;

  /** Standard: 0.65 */
  washOpacity?: number;
}) {
  const tokens = SECTION_THEMES[section];

  return (
    <SectionThemeProvider section={section}>
      <Screen backgroundColor={tokens.bg} style={style}>
        <View style={styles.root}>
          {wash ? (
            <View
              pointerEvents="none"
              style={[
                styles.wash,
                { backgroundColor: tokens.bg2, opacity: washOpacity },
              ]}
            />
          ) : null}

          {children}
        </View>
      </Screen>
    </SectionThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  wash: {
    position: "absolute",
    left: -24,
    right: -24,
    top: -24,
    height: 260,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
  },
});
