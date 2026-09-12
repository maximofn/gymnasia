import { Feather } from "@expo/vector-icons";
import { memo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AI_DISCLOSURE_MESSAGE_KIND } from "../agent/aiTransparency";
import { isReportableAssistantMessage } from "../agent/feedbackIssues";
import type { ChatMessage } from "../agent/chatModel";
import { AiIdentityDisclosure, AiIdentityPersistentDisclosure } from "../AiIdentityDisclosure";
import { AiResponseReportAction } from "../AiResponseReportModal";
import { HealthSafetyNotice } from "../HealthSafetyNotice";
import { mobileTheme } from "../theme";

export type PersonalFoodAssistantModel = {
  providerLabel: string;
  title: string;
  contextLabel?: string;
  messages: ChatMessage[];
  sending: boolean;
  input: string;
  detectedJson: Record<string, unknown> | null;
  canAddResult: boolean;
};

export type PersonalFoodAssistantActions = {
  close(): void;
  reportMessage(message: ChatMessage, messages: ChatMessage[]): void;
  addResult(result: Record<string, unknown>): void;
  changeInput(value: string): void;
  send(): void;
};

export const PersonalFoodAssistantScreen = memo(function PersonalFoodAssistantScreen({
  model,
  actions,
  scrollRef,
  testID,
}: {
  model: Readonly<PersonalFoodAssistantModel>;
  actions: Readonly<PersonalFoodAssistantActions>;
  scrollRef: import("react").RefObject<ScrollView | null>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
      <View>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10, marginBottom: 2 }}>{model.providerLabel}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 16 }}>{model.title}</Text>
            {model.contextLabel ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, marginTop: 2 }}>{model.contextLabel}</Text> : null}
          </View>
          <Pressable onPress={actions.close} accessibilityLabel="Cerrar Gymnasia Food Estimator" accessibilityRole="button" style={{ padding: 4 }}>
            <Feather name="x" size={18} color={mobileTheme.color.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView ref={scrollRef} testID="chat-message-list-personal-food-assistant" style={{ maxHeight: 320 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        <View style={{ marginBottom: 8 }}><AiIdentityDisclosure surface="personal-food-assistant" /></View>
        {model.messages.map((message) => message.kind === "health_safety_intervention" ? (
          <View key={message.id} style={{ marginBottom: 8, gap: 6 }}>
            <HealthSafetyNotice content={message.content} metadata={message.health_safety} compact />
            <AiResponseReportAction message={message} onPress={() => actions.reportMessage(message, model.messages)} />
          </View>
        ) : (
          <View key={message.id} testID={message.kind === AI_DISCLOSURE_MESSAGE_KIND ? "ai-intro-message-personal-food-assistant" : undefined} style={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", marginBottom: 8, borderRadius: 10, padding: 10, backgroundColor: message.role === "user" ? "rgba(203,255,26,0.1)" : mobileTheme.color.cardBg, borderWidth: 1, borderColor: message.kind === "technical_error" ? "rgba(255,122,122,0.55)" : message.role === "user" ? "rgba(203,255,26,0.25)" : mobileTheme.color.borderSubtle }}>
            <Text style={{ color: message.kind === "technical_error" ? "#FF8A8A" : mobileTheme.color.textPrimary, fontSize: 13, lineHeight: 19 }}>{message.content}</Text>
            {isReportableAssistantMessage(message) ? <View style={{ marginTop: 7 }}><AiResponseReportAction message={message} onPress={() => actions.reportMessage(message, model.messages)} /></View> : null}
          </View>
        ))}
        {model.sending ? <View style={{ alignSelf: "flex-start", marginBottom: 8 }}><ActivityIndicator size="small" color={mobileTheme.color.brandPrimary} /></View> : null}
      </ScrollView>

      {model.detectedJson && model.canAddResult ? (
        <Pressable onPress={() => actions.addResult(model.detectedJson!)} accessibilityLabel="Añadir resultado a mis alimentos" accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary }}>
          <Feather name="plus-circle" size={16} color="#000" />
          <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>Añadir a mis alimentos</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <TextInput testID="personal-food-assistant-input" value={model.input} onChangeText={actions.changeInput} placeholder="Ej: tortilla de patatas..." accessibilityLabel="Pregunta a Gymnasia Food Estimator sobre un alimento" placeholderTextColor={mobileTheme.color.textSecondary} onSubmitEditing={actions.send} multiline style={{ flex: 1, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, paddingHorizontal: 10, paddingVertical: 8, color: mobileTheme.color.textPrimary, fontSize: 14, backgroundColor: mobileTheme.color.cardBg, maxHeight: 120 }} />
        <Pressable testID="personal-food-assistant-send" onPress={actions.send} disabled={model.sending || !model.input.trim()} accessibilityLabel="Enviar mensaje a Gymnasia Food Estimator" accessibilityRole="button" style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderRadius: mobileTheme.radius.md, backgroundColor: model.sending || !model.input.trim() ? "#333" : mobileTheme.color.brandPrimary }}>
          <Feather name="send" size={16} color={model.sending || !model.input.trim() ? "#666" : "#000"} />
        </Pressable>
      </View>
      <AiIdentityPersistentDisclosure surface="personal-food-assistant" />
    </View>
  );
});
