import { Pressable, Text, View } from "react-native";
import { mobileTheme } from "../theme";

export function ToggleField({
  testID,
  label,
  description,
  variant = "notification",
  accessibilityLabel,
  accessibilityHint,
  status,
  statusTestID,
  checked,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  description?: string;
  variant?: "notification" | "inline";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  status?: string;
  statusTestID?: string;
  checked: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
  if (variant === "inline") {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        disabled={disabled}
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38, opacity: disabled ? 0.55 : 1 }}
      >
        <View style={{ width: 38, height: 22, borderRadius: 999, padding: 2, alignItems: checked ? "flex-end" : "flex-start", backgroundColor: checked ? mobileTheme.color.brandPrimary : "#3A414C" }}>
          <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: checked ? "#06090D" : "#A2AAB5" }} />
        </View>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600", flex: 1 }}>{label}</Text>
        {status !== undefined ? <Text testID={statusTestID} style={{ color: checked ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary, fontSize: 11 }}>{status}</Text> : null}
      </Pressable>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: mobileTheme.color.bgSurface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
        {description ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{description}</Text> : null}
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel ?? `${label}: ${checked ? "sí" : "no"}`}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ checked, disabled }}
        onPress={onPress}
        disabled={disabled}
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          backgroundColor: checked ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: checked ? 26 : 4,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#fff",
          }}
        />
      </Pressable>
    </View>
  );
}

