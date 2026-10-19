import { Feather } from "@expo/vector-icons";
import { Pressable, TextInput, View } from "react-native";
import { mobileTheme } from "../theme";

export function NumberStepper({ testID, value, invalid, step, onChange }: { testID: string; value: string; invalid: boolean; step: number; onChange(value: string): void }) {
  const nextValue = (direction: 1 | -1) => {
    if (step === 1) {
      return String(Math.max(0, (parseInt(value) || 0) + direction));
    }
    return Math.max(0, Math.round(((parseFloat(value) || 0) + step * direction) * 10) / 10).toFixed(1);
  };
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: invalid ? "#FF5A5F" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, minHeight: 42 }}>
      <TextInput
        testID={testID}
        style={{ flex: 1, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, minHeight: 42 }}
        value={value}
        onChangeText={onChange}
        placeholder={step < 1 ? "g/kg" : "kcal"}
        placeholderTextColor={mobileTheme.color.textSecondary}
        keyboardType="decimal-pad"
      />
      <View style={{ justifyContent: "center", paddingRight: 6 }}>
        <Pressable onPress={() => onChange(nextValue(1))} style={{ padding: 4 }}>
          <Feather name="chevron-up" size={16} color={mobileTheme.color.textSecondary} />
        </Pressable>
        <Pressable onPress={() => onChange(nextValue(-1))} style={{ padding: 4 }}>
          <Feather name="chevron-down" size={16} color={mobileTheme.color.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

