import { StyleSheet, View, type ViewProps } from "react-native";

/** Shell-owned layer: the caller retains Back handling, visibility, zIndex and confirmation. */
export function DialogLayer({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.layer, style]} />;
}

export function DialogCard({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#12151C", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, gap: 12 },
});
