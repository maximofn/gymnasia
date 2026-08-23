import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { mobileTheme } from "./theme";
import { describeOutcomeForUser } from "./agent/feedbackIssues";
import type { FeedbackProposal } from "./agent/feedbackProposals";

/**
 * Aviso NO bloqueante para proponer que se añada un alimento o un ejercicio
 * que falta en el catálogo.
 *
 * Antes estos dos caminos enviaban a GitHub sin preguntar (y en realidad no
 * enviaban nada, porque el token estaba vacío). Ahora nada sale hasta que el
 * usuario pulsa "Enviar", y el texto dice exactamente qué campos se envían.
 */

const COPY: Record<
  FeedbackProposal["draft"]["kind"],
  { heading: string; body: string } | null
> = {
  food: {
    heading: "Este alimento no está en el catálogo de Gymnasia.",
    body: "¿Nos lo envías para añadirlo? Se enviará solo esto: nombre, gramos, kcal y macros. Nada más de tu dieta ni de tu cuenta.",
  },
  exercise: {
    heading: "Este ejercicio no está en el catálogo.",
    body: "¿Nos lo envías para añadirlo? Se enviará solo: nombre, grupo muscular y equipamiento.",
  },
  // Las mejoras se confirman en la conversación del chat, no con un aviso.
  feature: null,
  // Las denuncias tienen su propio diálogo con previsualización completa.
  report: null,
};

export function FeedbackProposalBanner({
  proposal,
  onSubmit,
  onDismiss,
}: {
  proposal: FeedbackProposal;
  onSubmit: (proposal: FeedbackProposal) => void;
  onDismiss: (proposal: FeedbackProposal) => void;
}) {
  const copy = COPY[proposal.draft.kind];
  if (!copy) return null;

  const isSettled = proposal.status === "settled";
  const isSubmitting = proposal.status === "submitting";

  return (
    <View
      testID="feedback-proposal-banner"
      style={{
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        backgroundColor: mobileTheme.color.cardBg,
        borderRadius: mobileTheme.radius.md,
        padding: mobileTheme.spacing[3],
        gap: mobileTheme.spacing[2],
      }}
    >
      {isSettled && proposal.outcome ? (
        <Text
          testID="feedback-proposal-status"
          style={{ color: mobileTheme.color.textSecondary, fontSize: mobileTheme.typography.caption }}
        >
          {describeOutcomeForUser(proposal.outcome)}
        </Text>
      ) : (
        <>
          <Text
            style={{
              color: mobileTheme.color.textPrimary,
              fontSize: mobileTheme.typography.caption + 1,
              fontWeight: "700",
            }}
          >
            {copy.heading}
          </Text>
          <Text
            style={{
              color: mobileTheme.color.textSecondary,
              fontSize: mobileTheme.typography.caption,
            }}
          >
            {copy.body}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: mobileTheme.color.textPrimary,
              fontSize: mobileTheme.typography.caption,
              fontWeight: "600",
            }}
          >
            {proposal.draft.title}
          </Text>
          <View style={{ flexDirection: "row", gap: mobileTheme.spacing[2], alignItems: "center" }}>
            <Pressable
              testID="feedback-proposal-submit"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => onSubmit(proposal)}
              style={{
                backgroundColor: mobileTheme.color.accent,
                borderRadius: mobileTheme.radius.pill,
                paddingHorizontal: mobileTheme.spacing[4],
                paddingVertical: mobileTheme.spacing[2],
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: mobileTheme.color.bgApp, fontWeight: "700", fontSize: mobileTheme.typography.caption }}>
                Enviar
              </Text>
            </Pressable>
            <Pressable
              testID="feedback-proposal-dismiss"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => onDismiss(proposal)}
              style={{
                borderRadius: mobileTheme.radius.pill,
                paddingHorizontal: mobileTheme.spacing[4],
                paddingVertical: mobileTheme.spacing[2],
              }}
            >
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: mobileTheme.typography.caption }}>
                Ahora no
              </Text>
            </Pressable>
            {isSubmitting ? <ActivityIndicator color={mobileTheme.color.accent} /> : null}
          </View>
        </>
      )}
    </View>
  );
}
