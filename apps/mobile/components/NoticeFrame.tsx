import { View, type ViewProps } from "react-native";

import { mobileTheme } from "../theme";

/** Semantic wrappers retain their copy, announcements, severity and actions. */
export function NoticeFrame({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ borderWidth: 1, borderRadius: mobileTheme.radius.md }, style]} />;
}
