import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

type ChatComposerProps = Omit<ViewProps, "children"> & {
  input: ReactNode;
  action: ReactNode;
  footer?: ReactNode;
  layout?: "row" | "column";
  gap?: number;
};

/** Controlled slots preserve native input props and send/confirmation behavior. */
export function ChatComposer({ input, action, footer, layout = "column", gap = 8, style, ...props }: ChatComposerProps) {
  return <View {...props} style={[{ flexDirection: layout, gap }, layout === "row" ? { alignItems: "flex-end" } : null, style]}>{input}{action}{footer}</View>;
}
