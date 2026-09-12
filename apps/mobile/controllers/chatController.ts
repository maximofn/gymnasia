import { useCallback, useMemo, useRef, useState } from "react";

import type { ChatMessage } from "../agent/chatModel";
import {
  findPreviousUserMessage,
  isReportableAssistantMessage,
  type AiReportSurface,
  type AiResponseReportContext,
} from "../agent/feedbackIssues";
import type { ScreenController } from "./types";

export type ChatScreenModel = {
  error: string | null;
  hasConfiguredProvider: boolean;
  messages: ChatMessage[];
  expandedThinking: Readonly<Record<string, boolean>>;
  thinkingLabel: string;
  input: string;
  isSending: boolean;
  showByokExplanation: boolean;
  inputBottomPadding: number;
};

export type ChatScreenActions = {
  changeInput(value: string): void;
  send(): void;
  toggleThinking(messageId: string): void;
  reportMessage(surface: AiReportSurface, message: ChatMessage, messages: ChatMessage[]): void;
  openProviderSettings(): void;
  toggleByokExplanation(): void;
};

type ChatControllerInput = ChatScreenModel & {
  changeInput(value: string): void;
  send(): void;
  toggleThinking(messageId: string): void;
  reportMessage(surface: AiReportSurface, message: ChatMessage, messages: ChatMessage[]): void;
  openProviderSettings(): void;
  setShowByokExplanation(visible: boolean): void;
};

export function useChatController(
  input: ChatControllerInput,
): ScreenController<ChatScreenModel, ChatScreenActions, "byok-explanation"> {
  const targetsRef = useRef(input);
  targetsRef.current = input;
  const model = useMemo<ChatScreenModel>(() => ({
    error: input.error,
    hasConfiguredProvider: input.hasConfiguredProvider,
    messages: input.messages,
    expandedThinking: input.expandedThinking,
    thinkingLabel: input.thinkingLabel,
    input: input.input,
    isSending: input.isSending,
    showByokExplanation: input.showByokExplanation,
    inputBottomPadding: input.inputBottomPadding,
  }), [
    input.error,
    input.expandedThinking,
    input.hasConfiguredProvider,
    input.input,
    input.inputBottomPadding,
    input.isSending,
    input.messages,
    input.showByokExplanation,
    input.thinkingLabel,
  ]);
  const changeInput = useCallback((value: string) => targetsRef.current.changeInput(value), []);
  const send = useCallback(() => targetsRef.current.send(), []);
  const toggleThinking = useCallback(
    (messageId: string) => targetsRef.current.toggleThinking(messageId),
    [],
  );
  const reportMessage = useCallback(
    (surface: AiReportSurface, message: ChatMessage, messages: ChatMessage[]) => (
      targetsRef.current.reportMessage(surface, message, messages)
    ),
    [],
  );
  const openProviderSettings = useCallback(
    () => targetsRef.current.openProviderSettings(),
    [],
  );
  const toggleByokExplanation = useCallback(
    () => targetsRef.current.setShowByokExplanation(!targetsRef.current.showByokExplanation),
    [],
  );
  const closeByokExplanation = useCallback(() => {
    targetsRef.current.setShowByokExplanation(false);
    return true;
  }, []);
  const actions = useMemo<ChatScreenActions>(() => ({
    changeInput,
    send,
    toggleThinking,
    reportMessage,
    openProviderSettings,
    toggleByokExplanation,
  }), [
    changeInput,
    openProviderSettings,
    reportMessage,
    send,
    toggleByokExplanation,
    toggleThinking,
  ]);
  const layers = useMemo(
    () => ({ "byok-explanation": input.showByokExplanation }),
    [input.showByokExplanation],
  );
  const handlers = useMemo(
    () => ({ "byok-explanation": closeByokExplanation }),
    [closeByokExplanation],
  );
  const back = useMemo(() => ({ layers, handlers }), [handlers, layers]);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export function useAiReportController(appVersion: string): ScreenController<
  { context: AiResponseReportContext | null },
  {
    open(surface: AiReportSurface, message: ChatMessage, conversation: ChatMessage[]): void;
    close(): void;
  }
> {
  const [context, setContext] = useState<AiResponseReportContext | null>(null);
  const appVersionRef = useRef(appVersion);
  appVersionRef.current = appVersion;
  const model = useMemo(() => ({ context }), [context]);
  const actions = useMemo(() => ({
    open(surface: AiReportSurface, message: ChatMessage, conversation: ChatMessage[]) {
      if (!isReportableAssistantMessage(message)) return;
      const previousUserMessage = findPreviousUserMessage(conversation, message.id);
      if (!previousUserMessage) return;
      setContext({
        reportKey: `${surface}:${message.id}`,
        surface,
        question: previousUserMessage.content,
        response: message.content,
        appVersion: appVersionRef.current,
        provider: message.report_context?.provider,
        model: message.report_context?.model,
        origin: message.kind === "health_safety_intervention"
          ? "health_safety"
          : message.report_context?.origin ?? "unknown",
        healthSafety: message.health_safety
          ? {
              level: message.health_safety.level,
              policyVersion: message.health_safety.policyVersion,
              ruleIds: message.health_safety.ruleIds,
            }
          : null,
      });
    },
    close() {
      setContext(null);
    },
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
