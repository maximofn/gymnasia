export type ServerSentEvent = {
  event: string;
  data: string | null;
};

export function splitSSEEvents(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const boundary = normalized.indexOf("\n\n", cursor);
    if (boundary === -1) break;
    events.push(normalized.slice(cursor, boundary));
    cursor = boundary + 2;
  }
  return { events, rest: normalized.slice(cursor) };
}

export function parseSSEEvent(rawEvent: string): ServerSentEvent | null {
  const trimmed = rawEvent.trim();
  if (!trimmed) return null;
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of trimmed.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value || eventName;
    if (field === "data") dataLines.push(value);
  }
  return {
    event: eventName,
    data: dataLines.length > 0 ? dataLines.join("\n") : null,
  };
}

export function parseSSEJsonFixture<T>(fixture: string): T[] {
  const { events, rest } = splitSSEEvents(fixture.endsWith("\n\n") ? fixture : `${fixture}\n\n`);
  const chunks = rest.trim() ? [...events, rest] : events;
  return chunks.flatMap((chunk) => {
    const event = parseSSEEvent(chunk);
    if (!event?.data || event.data === "[DONE]") return [];
    try {
      return [JSON.parse(event.data) as T];
    } catch {
      return [];
    }
  });
}
