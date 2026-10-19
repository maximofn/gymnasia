import { Pressable, Text, View } from "react-native";
import { mobileTheme } from "../theme";

export function ToggleField({
  testID,
  label,
  description,
  checked,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
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
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
          {description}
        </Text>
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={`${label}: ${checked ? "sí" : "no"}`}
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

