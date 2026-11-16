import { Pressable, type PressableProps } from "react-native";

/** Layout only: children retain their domain-specific image, text and action slots. */
export function ItemRow({ style, ...props }: PressableProps) {
  return <Pressable {...props} style={(state) => [{ flexDirection: "row", alignItems: "center", gap: 10 }, typeof style === "function" ? style(state) : style]} />;
}
