import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import { AccessibilityInfo, Platform, Text, View } from "react-native";

import {
  getAiTransparencyCopy,
  type AiConversationSurface,
} from "./agent/aiTransparency";
import { mobileTheme } from "./theme";

type AiIdentityDisclosureProps = {
  surface: AiConversationSurface;
};

export function AiIdentityDisclosure({ surface }: AiIdentityDisclosureProps) {
  const copy = getAiTransparencyCopy(surface);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const timeout = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(copy.disclosureAccessibilityLabel);
    }, 150);
    return () => clearTimeout(timeout);
  }, [copy.disclosureAccessibilityLabel]);

  return (
    <View
      accessible
      accessibilityLabel={copy.disclosureAccessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      importantForAccessibility="yes"
      testID={`ai-identity-disclosure-${surface}`}
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        borderWidth: 1,
        borderColor: "rgba(203,255,26,0.36)",
        borderRadius: mobileTheme.radius.md,
        backgroundColor: "rgba(203,255,26,0.07)",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: mobileTheme.radius.pill,
          backgroundColor: "rgba(203,255,26,0.14)",
        }}
      >
        <Feather name="cpu" size={15} color={mobileTheme.color.brandPrimary} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            color: mobileTheme.color.brandPrimary,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "800",
          }}
        >
          {copy.disclosureTitle}
        </Text>
        <Text
          style={{
            color: mobileTheme.color.textSecondary,
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {copy.disclosureBody}
        </Text>
      </View>
    </View>
  );
}
