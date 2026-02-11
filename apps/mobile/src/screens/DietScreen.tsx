import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api, DailyDiet } from "../services/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function DietScreen() {
  const [diets, setDiets] = useState<DailyDiet[]>([]);
  const [name, setName] = useState("Dieta diaria");
  const [date, setDate] = useState(today());

  async function load() {
    const data = await api.listDailyDiets();
    setDiets(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await api.createDailyDiet(date, name);
    await load();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dieta</Text>
      <View style={styles.card}>
        <TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="YYYY-MM-DD" />
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Nombre" />
        <Pressable style={styles.button} onPress={create}>
          <Text style={styles.buttonText}>Crear dia</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        {diets.map((diet) => (
          <View key={diet.id} style={styles.item}>
            <Text style={styles.itemTitle}>{diet.name}</Text>
            <Text style={styles.itemSub}>{diet.diet_date}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#1f271b" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#d6d8d2", padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#d6d8d2", borderRadius: 10, padding: 10 },
  button: { backgroundColor: "#2e7d32", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  item: { borderWidth: 1, borderColor: "#e1e3de", borderRadius: 10, padding: 10 },
  itemTitle: { fontWeight: "700", color: "#1f271b" },
  itemSub: { color: "#61695f" }
});
