import { Feather } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { HealthSafetyMessageMetadata } from "./agent/healthSafety";
import { mobileTheme } from "./theme";

type HealthSafetyNoticeProps = {
  content: string;
  metadata?: HealthSafetyMessageMetadata;
  compact?: boolean;
};

export function HealthSafetyNotice({ content, metadata, compact = false }: HealthSafetyNoticeProps) {
  const title = metadata?.locale === "en"
    ? "Response limited for safety"
    : metadata?.locale === "pt"
      ? "Resposta limitada por segurança"
      : "Respuesta limitada por seguridad";
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="health-safety-intervention"
      style={{
        width: "100%",
        borderWidth: 1,
        borderColor: "rgba(255,205,77,0.65)",
        borderRadius: mobileTheme.radius.md,
        backgroundColor: "rgba(255,205,77,0.09)",
        padding: compact ? 10 : 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="shield" size={16} color="#FFCD4D" />
        <Text style={{ color: "#FFCD4D", fontWeight: "800", flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text style={{ color: mobileTheme.color.textPrimary, lineHeight: compact ? 19 : 21 }}>
        {content}
      </Text>
      {metadata ? (
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>
          Política {metadata.policyVersion} · {metadata.reasonCode}
        </Text>
      ) : null}
    </View>
  );
}
