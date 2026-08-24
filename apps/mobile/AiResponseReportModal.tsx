import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AI_REPORT_REASONS,
  formatAiResponseReport,
  isReportableAssistantMessage,
  REPORT_DETAILS_MAX_LENGTH,
  type AiReportReasonId,
  type AiResponseReportInput,
  type FeedbackIssueDraft,
  type FeedbackIssueOutcome,
  type ReportableChatMessage,
} from "./agent/feedbackIssues";
import { mobileTheme } from "./theme";

export type AiResponseReportContext = Omit<AiResponseReportInput, "reason" | "details"> & {
  reportKey: string;
};

type AiResponseReportActionProps = {
  message: ReportableChatMessage;
  onPress: () => void;
};

export function AiResponseReportAction({ message, onPress }: AiResponseReportActionProps) {
  if (!isReportableAssistantMessage(message)) return null;

  return (
    <Pressable
      accessibilityLabel="Denunciar esta respuesta"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      testID={`report-ai-response-${message.id}`}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        minHeight: 32,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 9,
        borderRadius: mobileTheme.radius.pill,
        borderWidth: 1,
        borderColor: pressed ? "rgba(203,255,26,0.55)" : mobileTheme.color.borderSubtle,
        backgroundColor: pressed ? "rgba(203,255,26,0.08)" : "transparent",
      })}
    >
      <Feather name="flag" size={13} color={mobileTheme.color.textSecondary} />
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
        Denunciar
      </Text>
    </Pressable>
  );
}

type AiResponseReportModalProps = {
  context: AiResponseReportContext | null;
  onClose: () => void;
  onSubmit: (draft: FeedbackIssueDraft) => Promise<FeedbackIssueOutcome>;
};

function reportOutcomeCopy(outcome: FeedbackIssueOutcome): string {
  switch (outcome.status) {
    case "created":
      return outcome.deduplicated
        ? `Esta denuncia ya se había recibido. Referencia ${outcome.issueNumber}.`
        : `Denuncia enviada. Referencia ${outcome.issueNumber}.`;
    case "canceled":
      return "No se ha enviado nada.";
    case "unavailable":
      return "Ahora mismo no se pueden enviar denuncias. El contenido sigue preparado para reintentar.";
    case "rejected":
      return outcome.reason === "rate_limited"
        ? "Has enviado varias denuncias seguidas. Espera un momento y vuelve a intentarlo."
        : "El envío ha sido rechazado. El contenido sigue preparado para reintentar.";
    case "error":
      return "No se ha podido enviar. El contenido sigue preparado para reintentar.";
  }
}

export function AiResponseReportModal({ context, onClose, onSubmit }: AiResponseReportModalProps) {
  const [reason, setReason] = useState<AiReportReasonId | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<FeedbackIssueOutcome | null>(null);

  useEffect(() => {
    setReason(null);
    setDetails("");
    setSubmitting(false);
    setOutcome(null);
  }, [context?.reportKey]);

  const draft = useMemo(() => {
    if (!context || !reason) return null;
    return formatAiResponseReport({ ...context, reason, details });
  }, [context, details, reason]);

  async function handleSubmit() {
    if (!draft || submitting) return;
    setSubmitting(true);
    setOutcome(null);
    try {
      setOutcome(await onSubmit(draft));
    } finally {
      setSubmitting(false);
    }
  }

  const succeeded = outcome?.status === "created";

  return (
    <Modal
      animationType="fade"
      onRequestClose={submitting ? undefined : onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={context !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.78)",
            justifyContent: "center",
            alignItems: "center",
            padding: mobileTheme.spacing[4],
          }}
        >
          <View
            testID="ai-report-modal"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "92%",
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "rgba(203,255,26,0.26)",
              backgroundColor: mobileTheme.color.bgSurface,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                minHeight: 66,
                paddingHorizontal: mobileTheme.spacing[4],
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: mobileTheme.color.borderSubtle,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(203,255,26,0.12)",
                }}
              >
                <Feather name="flag" size={17} color={mobileTheme.color.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                  Denunciar respuesta
                </Text>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Revisa exactamente qué vas a compartir
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar denuncia"
                accessibilityRole="button"
                disabled={submitting}
                hitSlop={10}
                onPress={onClose}
                style={{ padding: 4, opacity: submitting ? 0.45 : 1 }}
                testID="ai-report-close"
              >
                <Feather name="x" size={20} color={mobileTheme.color.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: mobileTheme.spacing[4], gap: 18 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 19 }}>
                Se enviarán la pregunta anterior y esta respuesta al equipo de Gymnasia. No se envía el resto de la conversación ni tu API key.
              </Text>

              <View style={{ gap: 9 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>
                  Motivo <Text style={{ color: mobileTheme.color.brandPrimary }}>*</Text>
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {AI_REPORT_REASONS.map((candidate) => {
                    const selected = candidate.id === reason;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        key={candidate.id}
                        onPress={() => {
                          setReason(candidate.id);
                          setOutcome(null);
                        }}
                        testID={`ai-report-reason-${candidate.id}`}
                        style={{
                          minHeight: 38,
                          justifyContent: "center",
                          paddingHorizontal: 12,
                          borderRadius: mobileTheme.radius.pill,
                          borderWidth: 1,
                          borderColor: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
                          backgroundColor: selected ? "rgba(203,255,26,0.12)" : mobileTheme.color.bgApp,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary,
                            fontSize: 13,
                            fontWeight: selected ? "700" : "600",
                          }}
                        >
                          {candidate.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>
                    Detalles opcionales
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                    {details.length}/{REPORT_DETAILS_MAX_LENGTH}
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel="Detalles opcionales de la denuncia"
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                  multiline
                  onChangeText={(value) => {
                    setDetails(value);
                    setOutcome(null);
                  }}
                  placeholder="¿Qué debería revisar el equipo?"
                  placeholderTextColor={mobileTheme.color.textSecondary}
                  style={{
                    minHeight: 92,
                    maxHeight: 150,
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgApp,
                    color: mobileTheme.color.textPrimary,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    textAlignVertical: "top",
                  }}
                  testID="ai-report-details"
                  value={details}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>
                  Contenido que se enviará
                </Text>
                <View
                  testID="ai-report-preview"
                  style={{
                    maxHeight: 250,
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgApp,
                    overflow: "hidden",
                  }}
                >
                  <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 12 }}>
                    <Text
                      selectable
                      style={{
                        color: draft ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary,
                        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                        fontSize: 11,
                        lineHeight: 17,
                      }}
                    >
                      {draft
                        ? `${draft.title}\n\n${draft.summary}`
                        : "Elige un motivo para generar la vista previa exacta."}
                    </Text>
                  </ScrollView>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
                  <Feather name="shield" size={13} color={mobileTheme.color.textSecondary} style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, color: mobileTheme.color.textSecondary, fontSize: 11, lineHeight: 16 }}>
                    Se crea una incidencia privada. La app elimina patrones de secretos antes de enviarla y el contenido se programa para borrarse automáticamente a los 30 días.
                  </Text>
                </View>
              </View>

              {outcome ? (
                <View
                  testID="ai-report-status"
                  style={{
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: succeeded ? "rgba(203,255,26,0.45)" : "rgba(255,138,138,0.45)",
                    backgroundColor: succeeded ? "rgba(203,255,26,0.08)" : "rgba(255,138,138,0.08)",
                    padding: 11,
                  }}
                >
                  <Text style={{ color: succeeded ? mobileTheme.color.brandPrimary : "#FF9A9A", fontSize: 13, lineHeight: 18 }}>
                    {reportOutcomeCopy(outcome)}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View
              style={{
                padding: mobileTheme.spacing[4],
                flexDirection: "row",
                gap: 10,
                borderTopWidth: 1,
                borderTopColor: mobileTheme.color.borderSubtle,
                backgroundColor: mobileTheme.color.bgSurface,
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onClose}
                testID="ai-report-cancel"
                style={{
                  flex: 1,
                  minHeight: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  opacity: submitting ? 0.45 : 1,
                }}
              >
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>
                  {succeeded ? "Cerrar" : "Cancelar"}
                </Text>
              </Pressable>
              {!succeeded ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={!draft || submitting}
                  onPress={() => void handleSubmit()}
                  testID="ai-report-submit"
                  style={{
                    flex: 1.3,
                    minHeight: 46,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: draft ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? <ActivityIndicator size="small" color="#07090D" /> : <Feather name="send" size={15} color="#07090D" />}
                  <Text style={{ color: draft ? "#07090D" : mobileTheme.color.textSecondary, fontSize: 14, fontWeight: "800" }}>
                    {submitting ? "Enviando..." : "Enviar denuncia"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
