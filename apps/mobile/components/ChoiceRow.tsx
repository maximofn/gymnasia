import { Text, View } from "react-native";
import { mobileTheme } from "../theme";
import { ChoiceChip } from "./ChoiceChip";

export function ChoiceRow<T extends string>({ label, options, selected, onSelect }: { label: string; options: ReadonlyArray<{ key: T; label: string }>; selected: T | undefined; onSelect(value: T): void }) {
  return (
    <>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected === option.key;
          return (
            <ChoiceChip
              key={option.key}
              label={option.label}
              selected={active}
              onPress={() => onSelect(option.key)}
              style={{ paddingVertical: 0, borderWidth: 1, borderColor: active ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.pill, paddingHorizontal: 12, minHeight: 34, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgApp }}
            >
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>{option.label}</Text>
            </ChoiceChip>
          );
        })}
      </View>
    </>
  );
}
