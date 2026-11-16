import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { mobileTheme } from "../theme";

export function StatCard({ label, value, subtitle, subtitleColor, icon, subtitleIcon, testID }: {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor?: string;
  icon?: ReactNode;
  subtitleIcon?: ReactNode;
  testID?: string;
}) {
  const labelNode = <Text style={styles.label}>{label}</Text>;
  return (
    <View testID={testID} style={styles.card}>
      {icon ? <View style={styles.heading}>{icon}{labelNode}</View> : labelNode}
      <Text style={styles.value}>{value}</Text>
      {subtitleIcon ? (
        <View style={styles.change}>
          {subtitleIcon}
          <Text style={[styles.subtitle, { color: subtitleColor, fontWeight: "700", flex: 1 }]}>{subtitle}</Text>
        </View>
      ) : <Text style={[styles.subtitle, { color: subtitleColor ?? "#7F8896", fontWeight: subtitleColor ? "700" : "400", marginTop: "auto" }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 94, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: 18, padding: 12, gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: "#8B94A3", fontSize: 12, fontWeight: "600" },
  value: { color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 11 },
  change: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: "auto" },
});
