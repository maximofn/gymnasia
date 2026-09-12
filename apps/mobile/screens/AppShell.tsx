import { Feather, Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

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

export const AppHeader = memo(function AppHeader({
  tab,
  title,
  isDesktop,
  trainingNested,
  trainingListLoading,
  workoutHistoryCount,
  onTabChange,
  onOpenTrainingHistory,
}: {
  tab: TabKey;
  title: string;
  isDesktop: boolean;
  trainingNested: boolean;
  trainingListLoading: boolean;
  workoutHistoryCount: number;
  onTabChange(tab: TabKey): void;
  onOpenTrainingHistory(): void;
}) {
  return (
    <View style={{ paddingHorizontal: isDesktop ? 32 : mobileTheme.spacing[4], paddingTop: mobileTheme.spacing[4], paddingBottom: 10, gap: 12 }}>
      {tab === "home" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}><TabTitle>Gymnasia</TabTitle></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} />
        </View>
      ) : tab === "training" && trainingNested ? null : tab === "training" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <TabTitle>{title}</TabTitle>
          {!trainingListLoading ? (
            <Pressable onPress={onOpenTrainingHistory} testID="training-open-global-history" accessibilityRole="button" accessibilityLabel="Abrir historial de entrenamientos" style={{ minHeight: 32, borderRadius: mobileTheme.radius.pill, borderWidth: 1, borderColor: "rgba(203,255,26,0.3)", backgroundColor: "rgba(203,255,26,0.08)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Feather name="clock" size={14} color={mobileTheme.color.brandPrimary} />
              <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>Historial{workoutHistoryCount > 0 ? ` · ${workoutHistoryCount}` : ""}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : <TabTitle>{title}</TabTitle>}

      {!isDesktop ? (
        <View style={{ minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, flexDirection: "row", padding: 4, gap: 4 }}>
          {TAB_DESTINATIONS.map(({ key, compactIcon, compactTestId, label, compactLabel }) => {
            const active = tab === key;
            const color = active ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary;
            return (
              <Pressable key={key} onPress={() => onTabChange(key)} testID={compactTestId} accessibilityLabel={label} accessibilityRole="button" style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(203,255,26,0.14)" : "transparent", borderWidth: active ? 1 : 0, borderColor: active ? "rgba(203,255,26,0.5)" : "transparent" }}>
                {compactIcon ? <Ionicons color={color} name={compactIcon as keyof typeof Ionicons.glyphMap} size={18} /> : <Text numberOfLines={1} style={{ color, fontWeight: "700", fontSize: 11 }}>{compactLabel}</Text>}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

export const InitialAppLoading = memo(function InitialAppLoading() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={mobileTheme.color.brandPrimary} /></View>;
});

export const GlobalScreenSkeleton = memo(function GlobalScreenSkeleton({ tab }: { tab: TabKey }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingBottom: 90 }}>
      <View testID={`screen-loading-skeleton-${tab}`} style={{ gap: 12, paddingBottom: 110 }}>
        <View style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: "#131923", width: tab === "chat" ? "72%" : "48%" }} />
        {Array.from({ length: tab === "chat" || tab === "home" ? 5 : 4 }).map((_, index) => (
          <View key={`screen_skeleton_${tab}_${index}`} style={{ minHeight: tab === "chat" ? 72 : tab === "home" ? 116 : 92, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: "#131923", paddingHorizontal: 14, paddingVertical: 14, gap: 10, opacity: index === 3 ? 0.66 : 1 }}>
            <View style={{ height: 12, width: index % 2 === 0 ? "74%" : "62%", borderRadius: 999, backgroundColor: "#242D3A" }} />
            <View style={{ height: 10, width: index % 2 === 0 ? "52%" : "70%", borderRadius: 999, backgroundColor: "#202837" }} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

export const TrainingScreenSkeleton = memo(function TrainingScreenSkeleton({ mode }: { mode: "list" | "editor" }) {
  if (mode === "list") {
    return (
      <View testID="training-list-loading-skeleton" style={{ gap: 12, paddingBottom: 110 }}>
        <View style={{ minHeight: 48, borderRadius: mobileTheme.radius.pill, backgroundColor: "#131923", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />
        <View style={{ flexDirection: "row", gap: 8 }}>{[74, 78, 88].map((width, index) => <View key={`skeleton_chip_${index}`} style={{ height: 38, width, borderRadius: mobileTheme.radius.pill, backgroundColor: "#131923", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />)}</View>
        <View style={{ gap: 10, paddingTop: 4 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`skeleton_card_${index}`} style={{ minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: "#131923", paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12, opacity: index === 3 ? 0.64 : 1 }}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: "#1C2330" }} />
              <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#202837" }} />
              <View style={{ flex: 1, gap: 10 }}><View style={{ height: 12, width: "88%", borderRadius: 999, backgroundColor: "#242D3A" }} /><View style={{ height: 10, width: "62%", borderRadius: 999, backgroundColor: "#202837" }} /></View>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View testID="training-editor-loading-skeleton" style={{ gap: 12, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ width: 96, height: 28, borderRadius: 999, backgroundColor: "#131923", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} /><View style={{ width: 116, height: 42, borderRadius: 14, backgroundColor: "#202837", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }} /></View>
      <View style={{ height: 48, width: "82%", borderRadius: 12, backgroundColor: "#1C2330", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />
      <View style={{ flexDirection: "row", gap: 8 }}>{[88, 74, 104].map((width, index) => <View key={`editor_skeleton_chip_${index}`} style={{ height: 36, width, borderRadius: mobileTheme.radius.pill, backgroundColor: "#131923", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />)}</View>
      {[0, 1].map((index) => <View key={`editor_action_${index}`} style={{ minHeight: 54, borderRadius: 16, backgroundColor: "#1A2B08", borderWidth: 1, borderColor: "rgba(203,255,26,0.15)" }} />)}
      <View style={{ gap: 10 }}>
        {Array.from({ length: 2 }).map((_, index) => (
          <View key={`editor_skeleton_card_${index}`} style={{ minHeight: 128, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: "#131923", padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#202837" }} /><View style={{ flex: 1, gap: 8 }}><View style={{ height: 12, width: "72%", borderRadius: 999, backgroundColor: "#242D3A" }} /><View style={{ height: 10, width: "54%", borderRadius: 999, backgroundColor: "#202837" }} /></View></View>
            <View style={{ height: 36, borderRadius: 10, backgroundColor: "#202630", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 40, borderRadius: 12, backgroundColor: "#171B23", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }} />
          </View>
        ))}
      </View>
      <View style={{ minHeight: 58, borderRadius: 16, backgroundColor: "#1A2B08", borderWidth: 1, borderColor: "rgba(203,255,26,0.15)" }} />
    </View>
  );
});

export const NewRoutineButton = memo(function NewRoutineButton({ visible, onPress }: { visible: boolean; onPress(): void }) {
  if (!visible) return null;
  return (
    <View style={{ position: "absolute", right: mobileTheme.spacing[4], bottom: 74 }}>
      <Pressable onPress={onPress} testID="training-create" style={{ minHeight: 56, borderRadius: mobileTheme.radius.pill, backgroundColor: mobileTheme.color.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 8, shadowColor: mobileTheme.color.brandPrimary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
        <Text style={{ color: "#06090D", fontSize: 24, fontWeight: "700", lineHeight: 26 }}>+</Text>
        <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "800" }}>Nueva rutina</Text>
      </Pressable>
    </View>
  );
});
