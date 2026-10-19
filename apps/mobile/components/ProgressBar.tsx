import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { mobileTheme } from "../theme";

export function ProgressBar({ percent, color = mobileTheme.color.brandPrimary, style, fillStyle }: {
  percent: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
}) {
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
});
