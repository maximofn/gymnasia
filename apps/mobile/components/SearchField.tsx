import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { mobileTheme } from "../theme";

export function SearchField({ value, onChange, placeholder }: {
  value: string;
  onChange(value: string): void;
  placeholder: string;
}) {
  return (
    <View style={styles.container}>
      <Feather name="search" size={16} color={mobileTheme.color.textSecondary} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={mobileTheme.color.textSecondary} style={styles.input} />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => onChange("")} style={{ padding: 4 }}><Feather name="x" size={16} color={mobileTheme.color.textSecondary} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgSurface, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, marginLeft: 8 },
});
