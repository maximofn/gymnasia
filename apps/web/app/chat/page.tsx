"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { api, ChatMessage, ChatThread } from "@/lib/api";

const sections = [
  { id: "training", label: "Entrenamiento" },
  { id: "diet", label: "Dieta" },
  { id: "measures", label: "Medidas" }
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function ChatPage() {
  const [section, setSection] = useState<SectionId>("training");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState("Conversacion nueva");
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) ?? null, [threads, activeThreadId]);

  async function loadThreads(targetSection: SectionId) {
    try {
      const data = await api.listThreads(targetSection);
      setThreads(data);
      if (data.length > 0) {
        setActiveThreadId(data[0].id);
      } else {
        setActiveThreadId(null);
        setMessages([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar hilos");
    }
  }

  async function loadMessages(threadId: string) {
    try {
      const data = await api.listMessages(threadId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar mensajes");
    }
  }

  useEffect(() => {
    void loadThreads(section);
  }, [section]);

  useEffect(() => {
    if (!activeThreadId) return;
    void loadMessages(activeThreadId);
  }, [activeThreadId]);

  async function handleCreateThread(event: FormEvent) {
    event.preventDefault();
    try {
      const thread = await api.createThread(section, newThreadTitle || "Conversacion nueva");
      await loadThreads(section);
      setActiveThreadId(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el hilo");
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeThreadId || !messageText.trim()) return;

    try {
      const result = await api.sendMessage(activeThreadId, messageText.trim());
      setMessages((prev) => [...prev, ...result]);
      setMessageText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar mensaje");
    }
  }

  async function handleAudioSelected(event: ChangeEvent<HTMLInputElement>) {
    if (!activeThreadId) return;
    const audio = event.target.files?.[0];
    if (!audio) return;

    try {
      const transcript = await api.sendAudio(activeThreadId, audio);
      setMessageText(transcript.transcript);
      await loadMessages(activeThreadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir audio");
    }
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
        <h2>Chat por seccion</h2>
        <p>Backend unificado, contexto separado por Entrenamiento, Dieta y Medidas. Soporta texto y audio.</p>
        {error && <p style={{ color: "#a53e2b" }}>{error}</p>}
      </div>

      <div className="panel" style={{ display: "grid", gap: ".7rem" }}>
        <div className="row">
          {sections.map((entry) => (
            <button
              key={entry.id}
              className={entry.id === section ? "" : "secondary"}
              onClick={() => setSection(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateThread} className="row">
          <input value={newThreadTitle} onChange={(event) => setNewThreadTitle(event.target.value)} placeholder="Titulo" />
          <button type="submit">Nuevo hilo</button>
        </form>

        <div className="row">
          <div className="panel" style={{ flex: 1, minWidth: 220 }}>
            <h3>Hilos</h3>
            <div className="list" style={{ marginTop: ".6rem" }}>
              {threads.length === 0 && <p>No hay hilos.</p>}
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  className={thread.id === activeThreadId ? "" : "secondary"}
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{ textAlign: "left" }}
                >
                  {thread.title}
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ flex: 2, minWidth: 280 }}>
            <h3>{activeThread?.title ?? "Selecciona un hilo"}</h3>
            <div className="chat-area" style={{ marginTop: ".6rem" }}>
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role === "user" ? "user" : "assistant"}`}>
                  {message.content}
                </article>
              ))}
            </div>
            {activeThreadId && (
              <form onSubmit={handleSendMessage} style={{ display: "grid", gap: ".5rem", marginTop: ".8rem" }}>
                <textarea
                  placeholder="Escribe tu mensaje..."
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                />
                <div className="row">
                  <button type="submit">Enviar</button>
                  <label className="secondary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    Microfono
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioSelected}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
