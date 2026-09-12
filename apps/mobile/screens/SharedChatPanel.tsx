import { Feather } from "@expo/vector-icons";
import { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AI_DISCLOSURE_MESSAGE_KIND,
  type AiConversationSurface,
} from "../agent/aiTransparency";
import { chatRoleLabel, type ChatMessage } from "../agent/chatModel";
import {
  AiIdentityDisclosure,
  AiIdentityPersistentDisclosure,
} from "../AiIdentityDisclosure";
import { AiResponseReportAction } from "../AiResponseReportModal";
import { HealthSafetyNotice } from "../HealthSafetyNotice";
import { mobileTheme } from "../theme";

function PrimaryButton({ label, onPress, disabled, icon, testID }: { label: string; onPress: () => void; disabled?: boolean; icon?: import("react").ReactNode; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        height: 46,
        borderRadius: 12,
        backgroundColor: mobileTheme.color.brandPrimary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? 10 : 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      <Text style={{ color: "#06090D", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

type SharedChatPanelProps = {
  variant: "coach" | "estimator";
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendLabel: string;
  inputPlaceholder: string;
  streamingIndicatorLabel: string;
  expandedThinking: Record<string, boolean>;
  onToggleThinking: (messageId: string) => void;
  pendingStatusMessage?: string | null;
  scrollRef?: import("react").RefObject<ScrollView | null>;
  disclosureSurface?: AiConversationSurface;
  onReportMessage: (message: ChatMessage, messages: ChatMessage[]) => void;
};

export const SharedChatPanel = memo(function SharedChatPanel({
  variant,
  messages,
  inputValue,
  onInputChange,
  onSend,
  sendDisabled,
  sendLabel,
  inputPlaceholder,
  streamingIndicatorLabel,
  expandedThinking,
  onToggleThinking,
  pendingStatusMessage,
  scrollRef,
  disclosureSurface,
  onReportMessage,
}: SharedChatPanelProps) {
  const isEstimator = variant === "estimator";
  const hasStreamingMessage = messages.some((message) => message.is_streaming);

  return (
    <View style={{ gap: isEstimator ? 8 : 12, flex: isEstimator ? 1 : undefined, minHeight: isEstimator ? 0 : undefined }}>
      {isEstimator ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: mobileTheme.color.borderSubtle,
            borderRadius: mobileTheme.radius.md,
            backgroundColor: mobileTheme.color.bgApp,
            flex: 1,
            minHeight: 80,
            padding: 8,
          }}
        >
          <ScrollView
            ref={scrollRef}
            testID={disclosureSurface ? `chat-message-list-${disclosureSurface}` : undefined}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
            nestedScrollEnabled
            onContentSizeChange={() => scrollRef?.current?.scrollToEnd({ animated: true })}
          >
            {disclosureSurface ? <AiIdentityDisclosure surface={disclosureSurface} /> : null}
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              if (msg.kind === "health_safety_intervention") {
                return (
                  <View key={msg.id} style={{ gap: 6 }}>
                    <HealthSafetyNotice content={msg.content} metadata={msg.health_safety} compact />
                    <AiResponseReportAction
                      message={msg}
                      onPress={() => onReportMessage(msg, messages)}
                    />
                  </View>
                );
              }
              return (
                <View
                  key={msg.id}
                  testID={msg.kind === AI_DISCLOSURE_MESSAGE_KIND ? "ai-intro-message-food-estimator" : undefined}
                  style={{
                    gap: 4,
                    alignSelf: isAssistant ? "flex-start" : "flex-end",
                    maxWidth: "92%",
                  }}
                >
                  {isAssistant && msg.thinking ? (
                    <Pressable
                      onPress={() => onToggleThinking(msg.id)}
                      style={{
                        borderWidth: 1,
                        borderColor: "rgba(147,112,219,0.35)",
                        backgroundColor: "rgba(147,112,219,0.06)",
                        borderRadius: mobileTheme.radius.md,
                        padding: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="cpu" size={12} color="rgba(147,112,219,0.8)" />
                        <Text style={{ color: "rgba(147,112,219,0.8)", fontSize: 12, fontWeight: "600", flex: 1 }}>
                          Razonamiento
                        </Text>
                        <Feather
                          name={expandedThinking[msg.id] ? "chevron-up" : "chevron-down"}
                          size={14}
                          color="rgba(147,112,219,0.6)"
                        />
                      </View>
                      {expandedThinking[msg.id] ? (
                        <ScrollView style={{ maxHeight: 200, marginTop: 8 }} nestedScrollEnabled>
                          <Text
                            style={{
                              color: mobileTheme.color.textSecondary,
                              fontSize: 13,
                              lineHeight: 18,
                              fontStyle: "italic",
                            }}
                          >
                            {msg.thinking}
                          </Text>
                        </ScrollView>
                      ) : null}
                    </Pressable>
                  ) : null}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: isAssistant
                        ? mobileTheme.color.borderSubtle
                        : "rgba(203,255,26,0.45)",
                      backgroundColor: isAssistant
                        ? mobileTheme.color.bgSurface
                        : "rgba(203,255,26,0.08)",
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    {msg.content.trim() ? (
                      <Text style={{ color: mobileTheme.color.textPrimary, lineHeight: 19 }}>
                        {msg.content}
                      </Text>
                    ) : null}
                    {msg.is_streaming ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginTop: msg.content.trim() ? 8 : 2,
                        }}
                      >
                        <ActivityIndicator size="small" color={mobileTheme.color.textSecondary} />
                        <Text
                          style={{
                            color: mobileTheme.color.textSecondary,
                            fontSize: 13,
                            lineHeight: 19,
                            fontStyle: "italic",
                          }}
                        >
                          {streamingIndicatorLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <AiResponseReportAction
                    message={msg}
                    onPress={() => onReportMessage(msg, messages)}
                  />
                </View>
              );
            })}
            {pendingStatusMessage && !hasStreamingMessage ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "92%",
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: mobileTheme.color.textSecondary, lineHeight: 19, fontStyle: "italic" }}>
                  {pendingStatusMessage}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          testID={disclosureSurface ? `chat-message-list-${disclosureSurface}` : undefined}
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ gap: 8 }}
          nestedScrollEnabled
          onContentSizeChange={() => scrollRef?.current?.scrollToEnd({ animated: true })}
        >
          {disclosureSurface ? <AiIdentityDisclosure surface={disclosureSurface} /> : null}
          {messages.map((msg) => {
            if (msg.kind === "health_safety_intervention") {
              return (
                <View key={msg.id} style={{ gap: 6 }}>
                  <HealthSafetyNotice content={msg.content} metadata={msg.health_safety} />
                  <AiResponseReportAction
                    message={msg}
                    onPress={() => onReportMessage(msg, messages)}
                  />
                </View>
              );
            }
            return (
            <View
              key={msg.id}
              testID={msg.kind === AI_DISCLOSURE_MESSAGE_KIND ? "ai-intro-message-shared-chat" : undefined}
              style={{ gap: 4 }}
            >
              {msg.role === "assistant" && msg.thinking ? (
                <Pressable
                  onPress={() => onToggleThinking(msg.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(147,112,219,0.35)",
                    backgroundColor: "rgba(147,112,219,0.06)",
                    borderRadius: mobileTheme.radius.md,
                    padding: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="cpu" size={12} color="rgba(147,112,219,0.8)" />
                    <Text style={{ color: "rgba(147,112,219,0.8)", fontSize: 12, fontWeight: "600", flex: 1 }}>
                      Razonamiento
                    </Text>
                    <Feather
                      name={expandedThinking[msg.id] ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="rgba(147,112,219,0.6)"
                    />
                  </View>
                  {expandedThinking[msg.id] ? (
                    <ScrollView style={{ maxHeight: 200, marginTop: 8 }} nestedScrollEnabled>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 18, fontStyle: "italic" }}>
                        {msg.thinking}
                      </Text>
                    </ScrollView>
                  ) : null}
                </Pressable>
              ) : null}
              <View
                style={{
                  borderWidth: 1,
                  borderColor:
                    msg.kind === "technical_error"
                      ? "rgba(255,122,122,0.55)"
                      : msg.role === "assistant"
                      ? "rgba(203,255,26,0.45)"
                      : mobileTheme.color.borderSubtle,
                  backgroundColor:
                    msg.role === "assistant"
                      ? "rgba(203,255,26,0.08)"
                      : mobileTheme.color.bgSurface,
                  borderRadius: mobileTheme.radius.md,
                  padding: 10,
                }}
              >
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{chatRoleLabel(msg.role)}</Text>
                {msg.content.trim() ? (
                  <Text style={{ color: msg.kind === "technical_error" ? "#FF8A8A" : mobileTheme.color.textPrimary, marginTop: 4 }}>{msg.content}</Text>
                ) : null}
                {msg.is_streaming ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: msg.content.trim() ? 8 : 4,
                    }}
                  >
                    <ActivityIndicator size="small" color={mobileTheme.color.textSecondary} />
                    <Text
                      style={{
                        color: mobileTheme.color.textSecondary,
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      {streamingIndicatorLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <AiResponseReportAction
                message={msg}
                onPress={() => onReportMessage(msg, messages)}
              />
            </View>
            );
          })}
          {pendingStatusMessage && !hasStreamingMessage ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: mobileTheme.color.borderSubtle,
                backgroundColor: mobileTheme.color.bgSurface,
                borderRadius: mobileTheme.radius.md,
                padding: 10,
              }}
            >
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontStyle: "italic" }}>
                {pendingStatusMessage}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {isEstimator ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <TextInput
            testID={disclosureSurface ? `${disclosureSurface}-input` : undefined}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              borderRadius: mobileTheme.radius.md,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgApp,
              color: mobileTheme.color.textPrimary,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 10,
            }}
            value={inputValue}
            onChangeText={onInputChange}
            placeholder={inputPlaceholder}
            accessibilityLabel="Pregunta a Gymnasia Food Estimator sobre la comida"
            placeholderTextColor={mobileTheme.color.textSecondary}
            multiline
          />
          <Pressable
            testID={disclosureSurface ? `${disclosureSurface}-send` : undefined}
            onPress={onSend}
            disabled={sendDisabled}
            accessibilityLabel={sendLabel}
            accessibilityRole="button"
            style={{
              minWidth: 92,
              height: 44,
              borderRadius: mobileTheme.radius.md,
              backgroundColor: mobileTheme.color.brandPrimary,
              alignItems: "center",
              justifyContent: "center",
              opacity: sendDisabled ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#06090D", fontWeight: "800" }}>{sendLabel}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={{
              minHeight: 44,
              maxHeight: 120,
              borderRadius: mobileTheme.radius.md,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgSurface,
              color: mobileTheme.color.textPrimary,
              paddingHorizontal: 12,
              paddingVertical: 10,
              textAlignVertical: "top",
            }}
            value={inputValue}
            onChangeText={onInputChange}
            placeholder={inputPlaceholder}
            placeholderTextColor={mobileTheme.color.textSecondary}
            multiline
            blurOnSubmit={false}
          />

          <PrimaryButton label={sendLabel} onPress={onSend} disabled={sendDisabled} />
        </>
      )}

      {disclosureSurface ? <AiIdentityPersistentDisclosure surface={disclosureSurface} /> : null}
    </View>
  );
});
