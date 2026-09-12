import { Feather, Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Image, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";

import type { AiReportSurface } from "../agent/feedbackIssues";
import type { ChatMessage } from "../agent/chatModel";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";
import { SharedChatPanel } from "./SharedChatPanel";

type FoodEstimatorOverlayProps = {
  open: boolean;
  providerLabel: string;
  images: ReadonlyArray<{ id: string; uri: string }>;
  maxImages: number;
  messages: ChatMessage[];
  inputValue: string;
  sending: boolean;
  statusLabel: string;
  expandedThinking: Record<string, boolean>;
  scrollRef: import("react").RefObject<ScrollView | null>;
  hasResponse: boolean;
  hasMealTarget: boolean;
  onClose(): void;
  onAddImageFromLibrary(): void;
  onAddImageFromCamera(): void;
  onRemoveImage(id: string): void;
  onInputChange(value: string): void;
  onSend(): void;
  onToggleThinking(messageId: string): void;
  onReportMessage(surface: AiReportSurface, message: ChatMessage, conversation: ChatMessage[]): void;
  onAddFood(): void;
};

export const FoodEstimatorOverlay = memo(function FoodEstimatorOverlay({
  open,
  providerLabel,
  images,
  maxImages,
  messages,
  inputValue,
  sending,
  statusLabel,
  expandedThinking,
  scrollRef,
  hasResponse,
  hasMealTarget,
  onClose,
  onAddImageFromLibrary,
  onAddImageFromCamera,
  onRemoveImage,
  onInputChange,
  onSend,
  onToggleThinking,
  onReportMessage,
  onAddFood,
}: FoodEstimatorOverlayProps) {
  if (!open) return null;
  const imageLimitReached = images.length >= maxImages;
  const canAddFood = hasResponse && hasMealTarget;
  return (
    <KeyboardAvoidingView testID={shellSurfaceTestId("food-estimator")} behavior="padding" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: mobileTheme.color.bgApp, zIndex: 610, elevation: 61 }}>
      <View style={{ paddingHorizontal: mobileTheme.spacing[4], paddingTop: mobileTheme.spacing[4], paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Cerrar Gymnasia Food Estimator" accessibilityRole="button">
              <Feather name="arrow-left" size={22} color={mobileTheme.color.textPrimary} />
            </Pressable>
            <Text numberOfLines={2} style={{ color: mobileTheme.color.textPrimary, fontSize: 18, lineHeight: 21, fontWeight: "800", flexShrink: 1 }}>Gymnasia Food Estimator</Text>
          </View>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>{providerLabel}</Text>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: mobileTheme.spacing[4], paddingTop: 10, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <EstimatorImageButton icon="image-outline" label="Subir foto" accessibilityLabel="Subir foto para estimar la comida" disabled={imageLimitReached} onPress={onAddImageFromLibrary} />
          <EstimatorImageButton icon="camera-outline" label="Cámara" accessibilityLabel="Hacer foto para estimar la comida" disabled={imageLimitReached} onPress={onAddImageFromCamera} />
        </View>

        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {images.map((image) => (
              <View key={image.id} style={{ width: 68, height: 68, borderRadius: 12, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, overflow: "hidden", backgroundColor: mobileTheme.color.bgSurface }}>
                <Image source={{ uri: image.uri }} style={{ width: "100%", height: "100%" }} />
                <Pressable onPress={() => onRemoveImage(image.id)} accessibilityLabel="Quitar foto de la estimación" accessibilityRole="button" style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="x" size={10} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <SharedChatPanel
          variant="estimator"
          messages={messages}
          inputValue={inputValue}
          onInputChange={onInputChange}
          onSend={onSend}
          sendDisabled={sending}
          sendLabel={sending ? "Enviando..." : "Enviar"}
          inputPlaceholder="Describe la comida o pide ajustes..."
          streamingIndicatorLabel={statusLabel}
          expandedThinking={expandedThinking}
          onToggleThinking={onToggleThinking}
          pendingStatusMessage={sending ? statusLabel : null}
          scrollRef={scrollRef}
          disclosureSurface="food-estimator"
          onReportMessage={(message, conversation) => onReportMessage("food-estimator", message, conversation)}
        />
      </View>

      <View style={{ paddingHorizontal: mobileTheme.spacing[4], paddingVertical: 10, borderTopWidth: 1, borderTopColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, gap: 6 }}>
        <Pressable onPress={onAddFood} disabled={!canAddFood || sending} style={{ minHeight: 46, borderRadius: mobileTheme.radius.md, backgroundColor: canAddFood ? mobileTheme.color.brandPrimary : mobileTheme.color.bgSurface, alignItems: "center", justifyContent: "center", opacity: !canAddFood || sending ? 0.5 : 1 }}>
          <Text style={{ color: canAddFood ? "#06090D" : mobileTheme.color.textSecondary, fontWeight: "700", fontSize: 15 }}>Añadir alimento</Text>
        </Pressable>
        {!hasMealTarget ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, textAlign: "center" }}>Abre primero "Añadir alimento" en una comida.</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
});

function EstimatorImageButton({
  icon,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: "image-outline" | "camera-outline";
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel} accessibilityRole="button" style={{ flex: 1, minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: "rgba(203,255,26,0.45)", backgroundColor: "rgba(203,255,26,0.10)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, opacity: disabled ? 0.5 : 1 }}>
      <Ionicons name={icon} size={16} color={mobileTheme.color.brandPrimary} />
      <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
