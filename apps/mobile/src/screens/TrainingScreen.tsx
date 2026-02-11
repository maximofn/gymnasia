import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api, TrainingPlan } from "../services/api";

export function TrainingScreen() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadPlans() {
    try {
      const data = await api.listPlans();
      setPlans(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando entrenamientos");
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  async function createPlan() {
    if (!name.trim()) return;
    try {
      await api.createPlan(name.trim());
      setName("");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Entrenamiento</Text>
      <Text style={styles.subtitle}>Plantillas, sesiones y PRs.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        <TextInput value={name} onChangeText={setName} placeholder="Nuevo entrenamiento" style={styles.input} />
        <Pressable onPress={createPlan} style={styles.button}>
          <Text style={styles.buttonText}>Crear</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        {plans.map((plan) => (
          <View key={plan.id} style={styles.item}>
            <Text style={styles.itemTitle}>{plan.name}</Text>
            <Text style={styles.itemSub}>Version {plan.version}</Text>
          </View>
        ))}
        {plans.length === 0 && <Text style={styles.itemSub}>No hay entrenamientos</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#1f271b" },
  subtitle: { color: "#455141" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#d6d8d2", padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#d6d8d2", borderRadius: 10, padding: 10 },
  button: { backgroundColor: "#2e7d32", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  item: { borderWidth: 1, borderColor: "#e1e3de", borderRadius: 10, padding: 10 },
  itemTitle: { fontWeight: "700", color: "#1f271b" },
  itemSub: { color: "#61695f" },
  error: { color: "#a53e2b" }
});
