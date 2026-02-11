import { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable } from "react-native";

import { ChatScreen } from "./src/screens/ChatScreen";
import { DietScreen } from "./src/screens/DietScreen";
import { MeasuresScreen } from "./src/screens/MeasuresScreen";
import { TrainingScreen } from "./src/screens/TrainingScreen";

type Tab = "training" | "diet" | "measures" | "chat";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "training", label: "Entreno" },
  { id: "diet", label: "Dieta" },
  { id: "measures", label: "Medidas" },
  { id: "chat", label: "Chat" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("training");

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.brand}>Gymnasia</Text>
      </View>
      <View style={styles.tabRow}>
        {tabs.map((entry) => (
          <Pressable key={entry.id} onPress={() => setTab(entry.id)} style={[styles.tab, entry.id === tab ? styles.tabActive : undefined]}>
            <Text style={entry.id === tab ? styles.tabActiveText : styles.tabText}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.content}>
        {tab === "training" && <TrainingScreen />}
        {tab === "diet" && <DietScreen />}
        {tab === "measures" && <MeasuresScreen />}
        {tab === "chat" && <ChatScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2ecdf" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  brand: { fontSize: 26, fontWeight: "700", color: "#1f271b" },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cfd4c8",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff"
  },
  tabActive: {
    backgroundColor: "#2e7d32",
    borderColor: "#2e7d32"
  },
  tabText: { color: "#253024", fontSize: 13 },
  tabActiveText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  content: { flex: 1 }
});
