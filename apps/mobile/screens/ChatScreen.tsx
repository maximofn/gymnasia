import { memo, useRef } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
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
  getAiTransparencyCopy,
} from "../agent/aiTransparency";
import { chatRoleLabel } from "../agent/chatModel";
import { AiIdentityDisclosure, AiIdentityPersistentDisclosure } from "../AiIdentityDisclosure";
import { AiResponseReportAction } from "../AiResponseReportModal";
import type { ChatScreenActions, ChatScreenModel } from "../controllers/chatController";
import { HealthSafetyNotice } from "../HealthSafetyNotice";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

export const ChatScreen = memo(function ChatScreen({
  model,
  actions,
}: {
  model: Readonly<ChatScreenModel>;
  actions: Readonly<ChatScreenActions>;
}) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1, paddingHorizontal: mobileTheme.spacing[4], gap: 10 }}>
      {model.error ? <Text style={{ color: "#ff8a8a", marginBottom: 12 }}>{model.error}</Text> : null}
      {model.hasConfiguredProvider ? (
        <View style={{ flex: 1, gap: 10 }}>
          <ScrollView
            ref={scrollRef}
            testID="chat-message-list-main-chat"
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <AiIdentityDisclosure surface="main-chat" />
            {model.messages.map((message) => {
              if (message.kind === "health_safety_intervention") {
                return (
                  <View key={message.id} style={{ gap: 6 }}>
                    <HealthSafetyNotice content={message.content} metadata={message.health_safety} />
                    <AiResponseReportAction
                      message={message}
                      onPress={() => actions.reportMessage("main-chat", message, model.messages)}
                    />
                  </View>
                );
              }
              return (
                <View
                  key={message.id}
                  testID={message.kind === AI_DISCLOSURE_MESSAGE_KIND
                    ? "ai-intro-message-main-chat"
                    : `chat-message-${message.role}-${message.id}`}
                  style={{ gap: 4 }}
                >
                  {message.role === "assistant" && message.thinking ? (
                    <Pressable
                      onPress={() => actions.toggleThinking(message.id)}
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
                          name={model.expandedThinking[message.id] ? "chevron-up" : "chevron-down"}
                          size={14}
                          color="rgba(147,112,219,0.6)"
                        />
                      </View>
                      {model.expandedThinking[message.id] ? (
                        <ScrollView style={{ maxHeight: 200, marginTop: 8 }} nestedScrollEnabled>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 18, fontStyle: "italic" }}>
                            {message.thinking}
                          </Text>
                        </ScrollView>
                      ) : null}
                    </Pressable>
                  ) : null}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: message.kind === "technical_error"
                        ? "rgba(255,122,122,0.55)"
                        : message.role === "assistant"
                          ? "rgba(203,255,26,0.45)"
                          : mobileTheme.color.borderSubtle,
                      backgroundColor: message.role === "assistant"
                        ? "rgba(203,255,26,0.08)"
                        : mobileTheme.color.bgSurface,
                      borderRadius: mobileTheme.radius.md,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      {chatRoleLabel(message.role)}
                    </Text>
                    {message.content.trim() ? (
                      <Text style={{ color: message.kind === "technical_error" ? "#FF8A8A" : mobileTheme.color.textPrimary, marginTop: 4 }}>
                        {message.content}
                      </Text>
                    ) : null}
                    {message.is_streaming ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: message.content.trim() ? 8 : 4 }}>
                        <ActivityIndicator size="small" color={mobileTheme.color.textSecondary} />
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontStyle: "italic" }}>
                          {`${model.thinkingLabel}...`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <AiResponseReportAction
                    message={message}
                    onPress={() => actions.reportMessage("main-chat", message, model.messages)}
                  />
                </View>
              );
            })}
          </ScrollView>
          <View style={{ paddingBottom: model.inputBottomPadding, gap: 8 }}>
            <TextInput
              testID="chat-input"
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
              value={model.input}
              onChangeText={actions.changeInput}
              placeholder="Pregunta a Gymnasia Coach"
              accessibilityLabel="Pregunta a Gymnasia Coach"
              placeholderTextColor={mobileTheme.color.textSecondary}
              multiline
              blurOnSubmit={false}
            />
            <Pressable
              onPress={actions.send}
              disabled={model.isSending}
              testID="chat-send"
              accessibilityLabel={model.isSending ? "Enviando..." : "Enviar"}
              accessibilityRole="button"
              style={{
                height: 46,
                borderRadius: 12,
                backgroundColor: mobileTheme.color.brandPrimary,
                alignItems: "center",
                justifyContent: "center",
                opacity: model.isSending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#06090D", fontWeight: "700" }}>
                {model.isSending ? "Enviando..." : "Enviar"}
              </Text>
            </Pressable>
            <AiIdentityPersistentDisclosure surface="main-chat" />
          </View>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 16, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <AiIdentityDisclosure surface="main-chat" />
          {model.messages
            .filter((message) => message.kind === AI_DISCLOSURE_MESSAGE_KIND)
            .slice(0, 1)
            .map((message) => (
              <View
                key={message.id}
                testID="ai-intro-message-main-chat"
                style={{
                  width: "100%",
                  borderWidth: 1,
                  borderColor: "rgba(203,255,26,0.45)",
                  backgroundColor: "rgba(203,255,26,0.08)",
                  borderRadius: mobileTheme.radius.md,
                  padding: 10,
                }}
              >
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                  {getAiTransparencyCopy("main-chat").agentName}
                </Text>
                <Text style={{ color: mobileTheme.color.textPrimary, marginTop: 4 }}>
                  {message.content}
                </Text>
              </View>
            ))}
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
            <Feather name="key" size={40} color="rgba(255,255,255,0.25)" />
          </View>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
            API Key no configurada
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22 }}>
            Para usar Gymnasia Coach necesitas configurar tu API Key. Obtén una API key de tu proveedor y añádela en los ajustes de la app.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(100,149,237,0.08)", borderWidth: 1, borderColor: "rgba(100,149,237,0.25)", borderRadius: mobileTheme.radius.md, padding: 14 }}>
            <Feather name="info" size={16} color="rgba(100,149,237,0.9)" />
            <Text style={{ color: "rgba(100,149,237,0.9)", fontSize: 13, flex: 1, lineHeight: 19 }}>
              Gymnasia guarda tus API keys solo en tu dispositivo, no las guarda en ningún otro lugar.
            </Text>
          </View>
          <Pressable
            onPress={actions.openProviderSettings}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, width: "100%", marginTop: 4 }}
          >
            <Ionicons name="settings-sharp" size={18} color="#06090D" />
            <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 16 }}>
              Ir a Ajustes BYOK
            </Text>
          </Pressable>
          <Pressable onPress={actions.toggleByokExplanation}>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
              {model.showByokExplanation ? "Ocultar" : "¿Qué es BYOK?"}
            </Text>
          </Pressable>
          {model.showByokExplanation ? (
            <View
              testID={shellSurfaceTestId("byok-explanation")}
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: mobileTheme.radius.md, padding: 14 }}
            >
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 20 }}>
                BYOK significa "Bring Your Own Key" (Trae Tu Propia Clave). Gymnasia no incluye acceso a ningún proveedor de IA. Tú proporcionas tu propia API key de OpenAI, Anthropic o Google, y las conversaciones se envían directamente desde tu dispositivo al proveedor. Gymnasia no envía tu clave a servidores propios; la usa únicamente para autenticar las peticiones ante el proveedor que eliges.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
});
