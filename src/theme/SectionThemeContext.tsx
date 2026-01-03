import React, { createContext, useContext, useMemo } from "react";
import { AppSection, SectionTokens, SECTION_THEMES } from "./sectionTheme";

type ThemeContextValue = {
  section: AppSection;
  tokens: SectionTokens;
};

const DEFAULT_SECTION: AppSection = "settings";

const Ctx = createContext<ThemeContextValue>({
  section: DEFAULT_SECTION,
  tokens: SECTION_THEMES[DEFAULT_SECTION],
});

export function SectionThemeProvider({
  section,
  children,
}: {
  section: AppSection;
  children: React.ReactNode;
}) {
  const value = useMemo<ThemeContextValue>(() => {
    const tokens = SECTION_THEMES[section] ?? SECTION_THEMES[DEFAULT_SECTION];
    return { section, tokens };
  }, [section]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSectionTheme() {
  return useContext(Ctx);
}
