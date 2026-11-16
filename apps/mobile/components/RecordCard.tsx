import { Pressable, View, type PressableProps, type ViewProps } from "react-native";

import { mobileTheme } from "../theme";

type RecordCardProps = ViewProps & Pick<PressableProps, "onPress" | "onLongPress" | "disabled"> & {
  variant?: "history" | "outline";
};

/** Shares the surface, without coupling measurement records to workout summaries. */
export function RecordCard({ variant = "history", style, onPress, onLongPress, disabled, ...props }: RecordCardProps) {
  const surface = variant === "history"
    ? { borderRadius: 18, borderColor: "rgba(255,255,255,0.05)", padding: 14, gap: 10 }
    : { borderRadius: mobileTheme.radius.lg, borderColor: mobileTheme.color.borderSubtle, padding: 12, gap: 8 };
  const cardStyle = [{ borderWidth: 1, backgroundColor: mobileTheme.color.bgSurface }, surface, style];
  return onPress || onLongPress
    ? <Pressable {...props} onPress={onPress} onLongPress={onLongPress} disabled={disabled} style={cardStyle} />
    : <View {...props} style={cardStyle} />;
}
