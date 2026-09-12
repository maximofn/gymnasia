import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { memo, useState } from "react";
import { Image, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type { AiReportSurface } from "../agent/feedbackIssues";
import type { ChatMessage } from "../agent/chatModel";
import { foodCatalogImageUri } from "../catalogs/sources";
import type { FoodCatalogEntry } from "../catalogs/types";
import { formatDietDayHeader, formatNutritionNumber, isoDateFromDate } from "../diet/model";
import type { DietMealCategory } from "../diet/nutritionContract";
import type { DietResolutionActions, DietResolutionModel } from "../controllers/dietController";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";
import { SharedChatPanel } from "./SharedChatPanel";

const DIET_COPY_META: Record<DietMealCategory, { accent: string; dot: string }> = {
  Desayuno: { accent: "#F7A547", dot: "#F7A547" },
  Almuerzo: { accent: "#FFD84D", dot: "#FFD84D" },
  Comida: { accent: "#CBFF1A", dot: "#CBFF1A" },
  Merienda: { accent: "#4D84FF", dot: "#4D84FF" },
  Cena: { accent: "#7D6DFF", dot: "#7D6DFF" },
};

export const DietResolutionOverlays = memo(function DietResolutionOverlays({
  model,
  actions,
}: {
  model: Readonly<DietResolutionModel>;
  actions: Readonly<DietResolutionActions>;
}) {
  const category = model.copyDateCategory;
  return (
    <>
      {category ? (
        model.isAndroid ? (
          <DateTimePicker testID={shellSurfaceTestId("diet-copy-date-picker")} value={model.copyDate} mode="date" display="default" onChange={(event, date) => actions.changeCopyDate(event.type, date)} />
        ) : (
          <View testID={shellSurfaceTestId("diet-copy-date-picker")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.78)", paddingHorizontal: 24, alignItems: "center", justifyContent: "center", zIndex: 620, elevation: 62 }}>
            <View style={{ width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#12151C", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, gap: 12 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" }}>Repetir {category}</Text>
              <Text style={{ color: "#A1AAB8", fontSize: 13, lineHeight: 19, textAlign: "center" }}>Elige el día del que quieres copiar los alimentos.</Text>
              {model.isWeb ? (
                <TextInput
                  value={model.copyDateText}
                  onChangeText={actions.changeCopyDateText}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={mobileTheme.color.textSecondary}
                  style={{ minHeight: 44, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: 12, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, fontSize: 14 }}
                />
              ) : (
                <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, padding: 8 }}>
                  <DateTimePicker value={model.copyDate} mode="date" display="inline" onChange={(event, date) => actions.changeCopyDate(event.type, date)} />
                </View>
              )}
              <Pressable
                onPress={() => actions.continueCopyDate(
                  category,
                  model.isWeb && /^\d{4}-\d{2}-\d{2}$/.test(model.copyDateText.trim())
                    ? model.copyDateText.trim()
                    : isoDateFromDate(model.copyDate),
                )}
                style={{ width: "100%", minHeight: 46, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 15 }}>Continuar</Text>
              </Pressable>
              <SecondaryButton label="Cancelar" onPress={actions.closeCopyDate} />
            </View>
          </View>
        )
      ) : null}

      {model.ambiguityCandidates ? (
        <View testID={shellSurfaceTestId("food-catalog-ambiguity")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 22, alignItems: "center", justifyContent: "center", zIndex: 740, elevation: 74 }}>
          <View style={{ width: "100%", maxWidth: 390, maxHeight: "80%", borderRadius: 22, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, padding: 16, gap: 12 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>Elige el alimento correcto</Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 19 }}>Necesitamos que confirmes a qué entrada te refieres. No guardaremos nada hasta que elijas una opción.</Text>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {model.ambiguityCandidates.map((candidate) => (
                <Pressable key={`${candidate.sourceId}/${candidate.id}`} testID={`food-catalog-candidate-${candidate.sourceId}-${candidate.id}`} onPress={() => actions.chooseFood(candidate)} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, padding: 10 }}>
                  <FoodThumbnail food={candidate} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>{candidate.name}</Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, marginTop: 2 }}>{candidate.sourceId} · {candidate.id} · {candidate.calories_per_100g} kcal/100g</Text>
                  </View>
                  <Feather name="chevron-right" size={17} color={mobileTheme.color.brandPrimary} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable testID="food-catalog-keep-manual" onPress={() => actions.chooseFood(null)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: "#1B1F27" }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>Conservar como manual</Text>
            </Pressable>
            <Pressable onPress={actions.closeAmbiguity} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {model.copyConfirmation ? (
        <DietCopyConfirmation
          confirmation={model.copyConfirmation}
          selectedDate={model.selectedDate}
          onConfirm={actions.confirmCopy}
          onCancel={actions.closeCopyConfirmation}
        />
      ) : null}
    </>
  );
});

function DietCopyConfirmation({ confirmation, selectedDate, onConfirm, onCancel }: {
  confirmation: NonNullable<DietResolutionModel["copyConfirmation"]>;
  selectedDate: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const meta = DIET_COPY_META[confirmation.category];
  return (
    <View testID={shellSurfaceTestId("diet-copy-confirmation")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.78)", paddingHorizontal: 24, alignItems: "center", justifyContent: "center", zIndex: 625, elevation: 63 }}>
      <View style={{ width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#12151C", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: `${meta.accent}22`, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
          <Feather name="copy" size={22} color={meta.accent} />
        </View>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" }}>Repetir {confirmation.category}</Text>
        <Text style={{ color: "#A1AAB8", fontSize: 13, lineHeight: 19, textAlign: "center" }}>Se añadirán estos alimentos del {formatDietDayHeader(confirmation.sourceDate)} a {confirmation.category} del {formatDietDayHeader(selectedDate)}.</Text>
        <ScrollView style={{ maxHeight: 240, width: "100%" }} contentContainerStyle={{ gap: 8 }}>
          {confirmation.items.map((item) => (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: 12, backgroundColor: mobileTheme.color.bgApp, paddingHorizontal: 10, paddingVertical: 8 }}>
              <DietItemThumbnail uri={item.image_uri} dotColor={meta.dot} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, marginTop: 1 }}>{item.grams > 0 ? `${formatNutritionNumber(item.grams)} g · ` : ""}{formatNutritionNumber(item.calories_kcal)} kcal</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, textAlign: "center" }}>{confirmation.items.length} {confirmation.items.length === 1 ? "alimento" : "alimentos"} · {formatNutritionNumber(confirmation.items.reduce((total, item) => total + item.calories_kcal, 0))} kcal</Text>
        <Pressable onPress={onConfirm} style={{ width: "100%", minHeight: 46, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Feather name="check" size={15} color="#06090D" />
          <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 15 }}>Confirmar</Text>
        </Pressable>
        <SecondaryButton label="Cancelar" onPress={onCancel} />
      </View>
    </View>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={{ width: "100%", minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1B1F27", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#E7EBF3", fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function DietItemThumbnail({ uri, dotColor, size = 36 }: { uri?: string | null; dotColor: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />;
  return <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dotColor, marginTop: 8 }} />;
}

function FoodThumbnail({ food, size = 36 }: { food: FoodCatalogEntry; size?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = foodCatalogImageUri(food);
  if (uri && !failed) return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: "rgba(203,255,26,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.44 }}>{food.category === "proteína" ? "🥩" : food.category === "carbohidrato" ? "🍚" : food.category === "grasa" ? "🫒" : food.category === "fruta" ? "🍎" : food.category === "verdura" ? "🥦" : food.category === "lácteo" ? "🥛" : food.category === "legumbre" ? "🫘" : food.category === "fruto-seco" ? "🥜" : "🍽️"}</Text>
    </View>
  );
}

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
