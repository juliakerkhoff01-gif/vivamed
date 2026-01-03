import React from "react";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

type Edge = "top" | "bottom" | "left" | "right";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  edges?: Edge[];
};

export function Screen({
  children,
  style,
  backgroundColor,
  edges = ["top"], // wichtig: bottom oft besser frei lassen (Composer/Buttons)
}: Props) {
  return (
    <SafeAreaView
      edges={edges}
      style={[
        {
          flex: 1,
          backgroundColor: backgroundColor ?? (colors as any).background ?? "#F7FAFC",
        },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}
