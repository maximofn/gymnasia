import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { mobileTheme } from "../theme";

export function ChartCard({ title, periodSelector, zIndex = 1, children, style }: {
  title: ReactNode;
  periodSelector: ReactNode;
  zIndex?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, { zIndex }, style]}>
      <View style={styles.heading}>
        <View style={{ flex: 1, gap: 4 }}>{title}</View>
        {periodSelector}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: mobileTheme.color.bgSurface, position: "relative", overflow: "visible", padding: 14, gap: 14 },
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, zIndex: 2 },
});
