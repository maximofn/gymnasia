import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { mobileTheme } from "../theme";

/** Keeps native input props/ref intact, including secure entry and keyboard handling. */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField({ style, placeholderTextColor = mobileTheme.color.textSecondary, ...props }, ref) {
  return <TextInput ref={ref} placeholderTextColor={placeholderTextColor} {...props} style={[styles.input, style]} />;
});

const styles = StyleSheet.create({
  input: { minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 },
});
