import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextStyle } from "react-native";

import { mobileTheme } from "../theme";

export function ChoiceChip({ label, selected, children, style, textStyle, ...props }: Omit<PressableProps, "children"> & {
  label: string;
  selected: boolean;
  children?: ReactNode;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} {...props} style={(state) => [styles.base, selected ? styles.selected : styles.idle, typeof style === "function" ? style(state) : style]}>
      {children ?? <Text style={[styles.label, { color: selected ? mobileTheme.color.brandPrimary : "#9EA6B3" }, textStyle]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: mobileTheme.radius.pill, borderWidth: 1 },
  selected: { borderColor: "rgba(203,255,26,0.82)", backgroundColor: "rgba(160,204,0,0.12)" },
  idle: { borderColor: mobileTheme.color.borderSubtle, backgroundColor: "#0D1117" },
  label: { fontSize: 14, fontWeight: "600" },
});
