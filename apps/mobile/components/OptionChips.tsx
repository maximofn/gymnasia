import { Text, View } from "react-native";
import { mobileTheme } from "../theme";
import { ChoiceChip } from "./ChoiceChip";

export function OptionChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: ReadonlyArray<string>;
  selected(option: string): boolean;
  onToggle(option: string, selected: boolean): void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected(option);
          return (
            <ChoiceChip key={option} label={option} selected={active} onPress={() => onToggle(option, active)} />
          );
        })}
      </View>
    </View>
  );
}

