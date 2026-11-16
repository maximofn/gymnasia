// The Coach chooses its recent conversation before adapting it to any provider.
// A provider may apply a smaller payload limit when serializing the request.
export const COACH_CONTEXT_MESSAGE_LIMIT = 20;

export function selectCoachContext<T>(messages: readonly T[]): T[] {
  return messages.slice(-COACH_CONTEXT_MESSAGE_LIMIT);
}
