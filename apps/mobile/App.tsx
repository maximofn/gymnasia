import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { mobileTheme } from "./theme";

type TabKey = "home" | "training" | "diet" | "measures" | "chat" | "settings";

type WorkoutTemplate = { id: string; name: string; exercises: Array<{ id: string; sets: unknown[] }> };
type DietItem = { calories_kcal?: number | null };
type DietDay = { day_date: string; meals: Array<{ id: string; title: string | null; items: DietItem[] }> };
type Measurement = { id: string; measured_at: string; weight_kg: number | null };
type ChatThread = { id: string; title: string | null };
type ChatMessage = { id: string; role: "user" | "assistant" | "system"; content: string };
type AIKey = { provider: "anthropic" | "openai" | "google"; is_active: boolean; key_fingerprint: string };

type Dashboard = {
  calories: number;
  weight: number | null;
  templates: number;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumDayCalories(day: DietDay | null): number {
  if (!day) return 0;
  return day.meals.reduce((mealAcc, meal) => {
    return (
      mealAcc +
      meal.items.reduce((itemAcc, item) => itemAcc + (item.calories_kcal ?? 0), 0)
    );
  }, 0);
}

function tabLabel(tab: TabKey): string {
  const map: Record<TabKey, string> = {
    home: "Home",
    training: "Train",
    diet: "Dieta",
    measures: "Stats",
    chat: "Chat",
    settings: "Cfg",
  };
  return map[tab];
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<Dashboard>({ calories: 0, weight: null, templates: 0 });
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [dietDay, setDietDay] = useState<DietDay | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const [keys, setKeys] = useState<AIKey[]>([]);

  const hasActiveKey = useMemo(() => keys.some((key) => key.is_active), [keys]);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = (await response.json()) as { detail?: string };
        message = payload.detail ?? message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async function login() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(result.access_token);
      setTab("home");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadCoreData() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const today = todayISO();
      const [remoteTemplates, remoteDiet, remoteMeasurements, remoteKeys] = await Promise.all([
        apiFetch<WorkoutTemplate[]>("/workouts/templates"),
        apiFetch<DietDay | null>(`/diet/days/${today}`),
        apiFetch<Measurement[]>("/measurements?limit=30"),
        apiFetch<AIKey[]>("/ai-keys"),
      ]);

      setTemplates(remoteTemplates);
      setDietDay(remoteDiet);
      setMeasurements(remoteMeasurements);
      setKeys(remoteKeys);

      setDashboard({
        calories: sumDayCalories(remoteDiet),
        weight: remoteMeasurements[0]?.weight_kg ?? null,
        templates: remoteTemplates.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoreData();
  }, [token]);

  async function loadChat() {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const remoteThreads = await apiFetch<ChatThread[]>("/chat/threads");
      let selectedThreadId: string;
      if (remoteThreads.length === 0) {
        const created = await apiFetch<ChatThread>("/chat/threads", {
          method: "POST",
          body: JSON.stringify({ title: "Coach principal" }),
        });
        setThreads([created]);
        selectedThreadId = created.id;
      } else {
        setThreads(remoteThreads);
        selectedThreadId = remoteThreads[0].id;
      }
      setActiveThreadId(selectedThreadId);

      const remoteMessages = await apiFetch<ChatMessage[]>(`/chat/threads/${selectedThreadId}/messages?limit=200`);
      setMessages(remoteMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar chat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "chat") {
      loadChat();
    }
  }, [tab]);

  async function sendMessage() {
    if (!activeThreadId || !chatInput.trim()) return;

    setSendingChat(true);
    setError(null);

    try {
      const created = await apiFetch<ChatMessage[]>(`/chat/threads/${activeThreadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      setMessages((prev) => [...prev, ...created]);
      setChatInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar mensaje.");
    } finally {
      setSendingChat(false);
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: mobileTheme.color.bgApp, padding: mobileTheme.spacing[4] }}>
        <View style={{ marginTop: mobileTheme.spacing[6] }}>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: mobileTheme.typography.caption }}>Acceso</Text>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 32, fontWeight: "700", marginTop: 8 }}>Gymnasia</Text>
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <TextInput
            style={{
              height: 46,
              borderRadius: mobileTheme.radius.md,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgSurface,
              color: mobileTheme.color.textPrimary,
              paddingHorizontal: 12,
            }}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={mobileTheme.color.textSecondary}
            autoCapitalize="none"
          />
          <TextInput
            style={{
              height: 46,
              borderRadius: mobileTheme.radius.md,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgSurface,
              color: mobileTheme.color.textPrimary,
              paddingHorizontal: 12,
            }}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={mobileTheme.color.textSecondary}
            secureTextEntry
          />
        </View>

        {authError ? <Text style={{ color: "#ff7f7f", marginTop: 12 }}>{authError}</Text> : null}

        <Pressable
          onPress={login}
          disabled={authLoading}
          style={{
            marginTop: 20,
            height: 52,
            borderRadius: mobileTheme.radius.md,
            backgroundColor: mobileTheme.color.brandPrimary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#06090D", fontSize: mobileTheme.typography.body, fontWeight: "700" }}>
            {authLoading ? "Entrando..." : "Entrar"}
          </Text>
        </Pressable>

        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: mobileTheme.color.bgApp }}>
      <View style={{ paddingHorizontal: mobileTheme.spacing[4], paddingTop: mobileTheme.spacing[4], paddingBottom: 10 }}>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: mobileTheme.typography.caption }}>Gymnasia v1</Text>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "700", marginTop: 2 }}>{tabLabel(tab)}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={mobileTheme.color.brandPrimary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingBottom: 90 }}>
          {error ? <Text style={{ color: "#ff8a8a", marginBottom: 12 }}>{error}</Text> : null}

          {tab === "home" ? (
            <View style={{ gap: 12 }}>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Calorías</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>{dashboard.calories.toFixed(0)} kcal</Text>
              </View>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Peso</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>
                  {dashboard.weight !== null ? `${dashboard.weight.toFixed(2)} kg` : "-"}
                </Text>
              </View>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Rutinas</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>{dashboard.templates}</Text>
              </View>
            </View>
          ) : null}

          {tab === "training" ? (
            <View style={{ gap: 10 }}>
              {templates.map((tpl) => (
                <View key={tpl.id} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>{tpl.name}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{tpl.exercises.length} ejercicios</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === "diet" ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Día {dietDay?.day_date ?? todayISO()}</Text>
              {(dietDay?.meals ?? []).map((meal) => (
                <View key={meal.id ?? `${meal.title}`} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>{meal.title ?? "Comida"}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{meal.items.length} items</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === "measures" ? (
            <View style={{ gap: 10 }}>
              {measurements.map((m) => (
                <View key={m.id} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>{new Date(m.measured_at).toLocaleString()}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{m.weight_kg !== null ? `${m.weight_kg} kg` : "Sin peso"}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === "chat" ? (
            hasActiveKey ? (
              <View style={{ gap: 10 }}>
                <View style={{ maxHeight: 360, gap: 8 }}>
                  {messages.map((msg) => (
                    <View
                      key={msg.id}
                      style={{
                        borderWidth: 1,
                        borderColor:
                          msg.role === "assistant"
                            ? "rgba(203,255,26,0.45)"
                            : mobileTheme.color.borderSubtle,
                        backgroundColor:
                          msg.role === "assistant"
                            ? "rgba(203,255,26,0.08)"
                            : mobileTheme.color.bgSurface,
                        borderRadius: mobileTheme.radius.md,
                        padding: 10,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{msg.role}</Text>
                      <Text style={{ color: mobileTheme.color.textPrimary, marginTop: 4 }}>{msg.content}</Text>
                    </View>
                  ))}
                </View>

                <TextInput
                  style={{
                    minHeight: 44,
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    color: mobileTheme.color.textPrimary,
                    paddingHorizontal: 12,
                  }}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Pregunta al coach IA"
                  placeholderTextColor={mobileTheme.color.textSecondary}
                />

                <Pressable
                  onPress={sendMessage}
                  disabled={sendingChat}
                  style={{
                    height: 46,
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>{sendingChat ? "Enviando..." : "Enviar"}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.lg, padding: 12, backgroundColor: mobileTheme.color.bgSurface }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Chat IA deshabilitado</Text>
                <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 6 }}>Configura BYOK en Ajustes para activar.</Text>
              </View>
            )
          ) : null}

          {tab === "settings" ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>BYOK</Text>
              {keys.map((key) => (
                <View key={key.provider} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.lg, padding: 12, backgroundColor: mobileTheme.color.bgSurface }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>{key.provider}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{key.is_active ? `Activo • ${key.key_fingerprint}` : "No activo"}</Text>
                </View>
              ))}

              <Pressable
                onPress={() => {
                  setToken(null);
                  setEmail("");
                  setPassword("");
                }}
                style={{
                  marginTop: 8,
                  height: 44,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: "rgba(255,100,100,0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#ffb5b5", fontWeight: "700" }}>Cerrar sesión</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        borderTopWidth: 1,
        borderTopColor: mobileTheme.color.borderSubtle,
        backgroundColor: mobileTheme.color.bgSurface,
        flexDirection: "row",
      }}>
        {(["home", "training", "diet", "measures", "chat", "settings"] as TabKey[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: tab === key ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary, fontWeight: "700", fontSize: 12 }}>{tabLabel(key)}</Text>
          </Pressable>
        ))}
      </View>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
