"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { hasAuthToken } from "../../lib/api";
import {
  createChatThread,
  deleteMemory,
  listChatMessages,
  listChatThreads,
  listMemory,
  sendChatMessage,
  upsertMemory,
  type ChatMessage,
  type ChatThread,
  type MemoryDomain,
  type MemoryEntry,
} from "../../lib/chat";
import { hasAnyActiveAIKey, listAIKeys } from "../../lib/ai-keys";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const forcedEnabledRaw = searchParams.get("enabled");
  const forcedEnabled = forcedEnabledRaw === "1" ? true : forcedEnabledRaw === "0" ? false : null;

  const [tokenAvailable, setTokenAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enabledByKey, setEnabledByKey] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [memoryKey, setMemoryKey] = useState("");
  const [memoryValue, setMemoryValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTokenAvailable(hasAuthToken());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (forcedEnabled !== null) {
        setEnabledByKey(forcedEnabled);
        setLoading(false);
        return;
      }

      if (!tokenAvailable) {
        setEnabledByKey(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const keys = await listAIKeys();
        const enabled = hasAnyActiveAIKey(keys);
        if (!mounted) return;

        setEnabledByKey(enabled);
        if (!enabled) {
          setLoading(false);
          return;
        }

        let existingThreads = await listChatThreads();
        if (!mounted) return;

        if (existingThreads.length === 0) {
          const created = await createChatThread("Coach principal");
          existingThreads = [created];
        }

        setThreads(existingThreads);
        setActiveThreadId(existingThreads[0].id);

        const [threadMessages, memory] = await Promise.all([
          listChatMessages(existingThreads[0].id, 300),
          listMemory(),
        ]);
        if (!mounted) return;

        setMessages(threadMessages);
        setMemoryEntries(memory);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "No se pudo cargar chat IA.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [forcedEnabled, tokenAvailable]);

  useEffect(() => {
    if (!activeThreadId || !enabledByKey) return;
    const threadId = activeThreadId;

    let mounted = true;
    async function loadThreadMessages() {
      try {
        const threadMessages = await listChatMessages(threadId, 300);
        if (mounted) setMessages(threadMessages);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "No se pudo cargar mensajes.");
      }
    }

    loadThreadMessages();
    return () => {
      mounted = false;
    };
  }, [activeThreadId, enabledByKey]);

  const enabled = useMemo(() => {
    if (forcedEnabled !== null) return forcedEnabled;
    return enabledByKey;
  }, [forcedEnabled, enabledByKey]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeThreadId || !draftMessage.trim()) return;

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const created = await sendChatMessage(activeThreadId, draftMessage.trim());
      setMessages((prev) => [...prev, ...created]);
      setDraftMessage("");
      const refreshed = await listChatThreads();
      setThreads(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar mensaje.");
    } finally {
      setSending(false);
    }
  };

  const saveMemory = async (domain: MemoryDomain = "global") => {
    if (!memoryKey.trim() || !memoryValue.trim()) return;

    setError(null);
    setMessage(null);

    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(memoryValue) as Record<string, unknown>;
      } catch {
        parsed = { text: memoryValue };
      }

      const saved = await upsertMemory(domain, memoryKey.trim(), parsed);
      setMemoryEntries((prev) => {
        const rest = prev.filter((item) => !(item.domain === saved.domain && item.memory_key === saved.memory_key));
        return [saved, ...rest];
      });
      setMemoryKey("");
      setMemoryValue("");
      setMessage("Memoria actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar memoria.");
    }
  };

  const removeMemory = async (entry: MemoryEntry) => {
    try {
      await deleteMemory(entry.domain, entry.memory_key);
      setMemoryEntries((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar memoria.");
    }
  };

  return (
    <>
      <p className="page-subtitle">Asistente</p>
      <h1 className="page-title">Chat IA</h1>

      {error ? <p className="status-message error">{error}</p> : null}
      {message ? <p className="status-message ok">{message}</p> : null}

      {loading ? (
        <section className="state-card">
          <h3 className="state-title">Comprobando estado IA...</h3>
          <div className="state-loading-list">
            <div className="skeleton" />
          </div>
        </section>
      ) : enabled ? (
        <section className="chat-layout">
          <aside className="chat-sidebar">
            <div className="row">
              <h3 className="info-title">Conversaciones</h3>
              <button
                className="action-pill"
                onClick={async () => {
                  try {
                    const thread = await createChatThread("Nueva conversacion");
                    setThreads((prev) => [thread, ...prev]);
                    setActiveThreadId(thread.id);
                    setMessages([]);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "No se pudo crear conversacion.");
                  }
                }}
              >
                +
              </button>
            </div>

            <div className="chat-thread-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  className={activeThreadId === thread.id ? "chat-thread-item active" : "chat-thread-item"}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <p className="info-title">{thread.title ?? "Sin titulo"}</p>
                  <p className="routine-meta">{thread.last_message_preview ?? "Sin mensajes"}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="chat-main">
            <div className="chat-message-list">
              {messages.length === 0 ? (
                <p className="state-text">Empieza una conversación con tu coach IA.</p>
              ) : (
                messages.map((entry) => (
                  <article key={entry.id} className={entry.role === "assistant" ? "chat-msg assistant" : "chat-msg user"}>
                    <p className="chat-msg-role">{entry.role === "assistant" ? "Coach IA" : "Tú"}</p>
                    <p>{entry.content}</p>
                  </article>
                ))
              )}
            </div>

            <form className="chat-input-row" onSubmit={sendMessage}>
              <input
                className="builder-input"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Pregunta sobre técnica, progresión o dieta..."
              />
              <button className="cta" disabled={sending}>
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </div>

          <aside className="chat-memory">
            <h3 className="info-title">Memoria</h3>
            <div className="chat-memory-list">
              {memoryEntries.map((entry) => (
                <article key={entry.id} className="chat-memory-item">
                  <p className="info-title">{entry.domain}: {entry.memory_key}</p>
                  <p className="routine-meta">{JSON.stringify(entry.memory_value)}</p>
                  <button className="action-pill danger" onClick={() => removeMemory(entry)}>
                    Borrar
                  </button>
                </article>
              ))}
            </div>

            <div className="chat-memory-editor">
              <input
                className="set-input"
                value={memoryKey}
                onChange={(event) => setMemoryKey(event.target.value)}
                placeholder="memory_key"
              />
              <input
                className="set-input"
                value={memoryValue}
                onChange={(event) => setMemoryValue(event.target.value)}
                placeholder='{"text":"prefiere rutina torso-pierna"}'
              />
              <button className="tag" onClick={() => saveMemory("global")}>Guardar memoria</button>
            </div>
          </aside>
        </section>
      ) : (
        <section className="state-card">
          <h3 className="state-title">IA deshabilitada</h3>
          <p className="state-text">Configura tu API key en Ajustes BYOK para activar el chat.</p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/settings/byok" className="cta cta-link">
              Ir a BYOK
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
