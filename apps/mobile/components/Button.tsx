import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextStyle } from "react-native";

import { mobileTheme } from "../theme";

type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  textStyle?: StyleProp<TextStyle>;
};

/** Visual action only: confirmation, loading and persistence belong to the caller. */
export function Button({ label, icon, variant = "primary", disabled, style, textStyle, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
      disabled={disabled}
      style={(state) => {
        const customStyle = typeof style === "function" ? style(state) : style;
        const size = StyleSheet.flatten(customStyle);
        return [
          styles.base,
          size?.height === undefined && size?.minHeight === undefined ? styles.defaultSize : null,
          styles[variant],
          { gap: icon ? 10 : 0, opacity: disabled ? 0.6 : 1 },
          customStyle,
        ];
      }}
    >
      {icon}
      <Text style={[styles.label, { color: variant === "primary" ? "#06090D" : variant === "destructive" ? "#FFE8EB" : "#E7EBF3" }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  defaultSize: { height: 46 },
  primary: { backgroundColor: mobileTheme.color.brandPrimary },
  secondary: { backgroundColor: "#1B1F27", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  outline: { backgroundColor: mobileTheme.color.bgApp, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: "#FF4D4F" },
  label: { fontWeight: "700" },
});
