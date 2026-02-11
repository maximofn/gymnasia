import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api, ChatMessage, ChatThread } from "../services/api";

const sections = [
  { id: "training", label: "Entreno" },
  { id: "diet", label: "Dieta" },
  { id: "measures", label: "Medidas" }
] as const;

type SectionId = (typeof sections)[number]["id"];

export function ChatScreen() {
  const [section, setSection] = useState<SectionId>("training");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadTitle, setThreadTitle] = useState("Conversacion");
  const [message, setMessage] = useState("");

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) ?? null, [threads, activeThreadId]);

  async function loadThreads() {
    const data = await api.listThreads(section);
    setThreads(data);
    if (data[0]) {
      setActiveThreadId(data[0].id);
    } else {
      setActiveThreadId(null);
      setMessages([]);
    }
  }

  async function loadMessages(threadId: string) {
    const data = await api.listMessages(threadId);
    setMessages(data);
  }

  useEffect(() => {
    void loadThreads();
  }, [section]);

  useEffect(() => {
    if (!activeThreadId) return;
    void loadMessages(activeThreadId);
  }, [activeThreadId]);

  async function createThread() {
    const thread = await api.createThread(section, threadTitle);
    await loadThreads();
    setActiveThreadId(thread.id);
  }

  async function send() {
    if (!activeThreadId || !message.trim()) return;
    const data = await api.sendMessage(activeThreadId, message);
    setMessages((prev) => [...prev, ...data]);
    setMessage("");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Chat IA</Text>
      <View style={styles.tabRow}>
        {sections.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, tab.id === section ? styles.tabActive : undefined]}
            onPress={() => setSection(tab.id)}
          >
            <Text style={tab.id === section ? styles.tabActiveText : styles.tabText}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        <TextInput value={threadTitle} onChangeText={setThreadTitle} style={styles.input} placeholder="Titulo hilo" />
        <Pressable style={styles.button} onPress={createThread}>
          <Text style={styles.buttonText}>Nuevo hilo</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.itemTitle}>{activeThread?.title ?? "Selecciona un hilo"}</Text>
        {threads.map((thread) => (
          <Pressable key={thread.id} onPress={() => setActiveThreadId(thread.id)} style={styles.item}>
            <Text style={styles.itemSub}>{thread.title}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.message, msg.role === "user" ? styles.messageUser : styles.messageAssistant]}>
            <Text>{msg.content}</Text>
          </View>
        ))}
        <TextInput value={message} onChangeText={setMessage} style={styles.input} placeholder="Escribe..." />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable style={[styles.button, { flex: 1 }]} onPress={send}>
            <Text style={styles.buttonText}>Enviar</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { flex: 1 }]}>
            <Text style={styles.secondaryText}>Microfono</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#1f271b" },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: { borderWidth: 1, borderColor: "#cfd4c8", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  tabActive: { backgroundColor: "#2e7d32", borderColor: "#2e7d32" },
  tabText: { color: "#2f3b2c" },
  tabActiveText: { color: "#ffffff", fontWeight: "700" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#d6d8d2", padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#d6d8d2", borderRadius: 10, padding: 10 },
  button: { backgroundColor: "#2e7d32", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfd4c8",
    backgroundColor: "#fff"
  },
  secondaryText: { color: "#2f3b2c", fontWeight: "700" },
  item: { borderWidth: 1, borderColor: "#e1e3de", borderRadius: 10, padding: 8 },
  itemTitle: { fontWeight: "700", color: "#1f271b" },
  itemSub: { color: "#61695f" },
  message: { borderRadius: 10, padding: 8 },
  messageUser: { alignSelf: "flex-end", backgroundColor: "#d7f0de" },
  messageAssistant: { alignSelf: "flex-start", backgroundColor: "#f5f5f5" }
});
