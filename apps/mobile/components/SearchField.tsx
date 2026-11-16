import { Feather } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

import { mobileTheme } from "../theme";

type SearchFieldProps = {
  value: string;
  onChange(value: string): void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "placeholder">;
  iconSize?: number;
  showClear?: boolean;
  size?: "compact" | "content";
  onClear?(): void;
  iconColor?: string;
  clearStyle?: StyleProp<ViewStyle>;
};

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField({ value, onChange, placeholder, style, inputProps, iconSize = 16, showClear = true, size = "compact", onClear, iconColor = mobileTheme.color.textSecondary, clearStyle }, ref) {
  return (
    <View style={[styles.container, size === "compact" ? { height: 40 } : null, style]}>
      <Feather name="search" size={iconSize} color={iconColor} />
      <TextInput ref={ref} placeholderTextColor={mobileTheme.color.textSecondary} {...inputProps} value={value} onChangeText={onChange} placeholder={placeholder} style={[styles.input, inputProps?.style]} />
      {showClear && value ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={onClear ?? (() => onChange(""))} style={[{ padding: 4 }, clearStyle]}><Feather name="x" size={16} color={iconColor} /></Pressable> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgSurface, paddingHorizontal: 10 },
  input: { flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, marginLeft: 8 },
});
