import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { TAB_DESTINATIONS, type TabKey } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

export const TabTitle = memo(function TabTitle({ children }: { children: string }) {
  return (
    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 30, fontWeight: "700" }}>
      {children}
    </Text>
  );
});

export const DesktopSidebar = memo(function DesktopSidebar({
  tab,
  onTabChange,
}: {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <View style={{ width: 246, flexShrink: 0, paddingHorizontal: 18, paddingVertical: 24, gap: 26, borderRightWidth: 1, borderRightColor: mobileTheme.color.borderSubtle, backgroundColor: "#0A0E14" }}>
      <View style={{ paddingHorizontal: 10, gap: 5 }}>
        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 23, fontWeight: "900", letterSpacing: 3 }}>
          GYMNASIA
        </Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10, letterSpacing: 1.4 }}>
          LOCAL-FIRST FITNESS
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {TAB_DESTINATIONS.map(({ key, desktopIcon, desktopTestId, label }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => onTabChange(key)}
              testID={desktopTestId}
              accessibilityLabel={label}
              accessibilityRole="button"
              style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: active ? "rgba(203,255,26,0.12)" : "transparent", borderWidth: 1, borderColor: active ? "rgba(203,255,26,0.38)" : "transparent" }}
            >
              <Ionicons
                name={desktopIcon as keyof typeof Ionicons.glyphMap}
                size={19}
                color={active ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary}
              />
              <Text style={{ color: active ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14, fontWeight: active ? "800" : "600" }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: "auto", borderWidth: 1, borderColor: "rgba(203,255,26,0.22)", borderRadius: 14, backgroundColor: "rgba(203,255,26,0.06)", padding: 12, gap: 5 }}>
        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
          LOCAL-FIRST
        </Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}>
          Tu progreso se queda en este navegador.
        </Text>
      </View>
    </View>
  );
});
