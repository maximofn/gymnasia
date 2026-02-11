"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, DailyDiet, FoodItem } from "@/lib/api";

export default function DietPage() {
  const [dailyDiets, setDailyDiets] = useState<DailyDiet[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [dietDate, setDietDate] = useState(new Date().toISOString().slice(0, 10));
  const [dietName, setDietName] = useState("Dieta diaria");

  const [foodName, setFoodName] = useState("");
  const [foodProtein, setFoodProtein] = useState("0");
  const [foodCarbs, setFoodCarbs] = useState("0");
  const [foodFats, setFoodFats] = useState("0");
  const [foodCalories, setFoodCalories] = useState("0");

  async function loadData() {
    try {
      const [diets, foodsResponse] = await Promise.all([api.listDailyDiets(), api.listFoods()]);
      setDailyDiets(diets);
      setFoods(foodsResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Dieta");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateDiet(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createDailyDiet({
        diet_date: dietDate,
        name: dietName,
        phase: "mantenimiento"
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la dieta diaria");
    }
  }

  async function handleCreateFood(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createFood({
        name: foodName,
        unit: "g",
        protein_per_100g: Number(foodProtein),
        carbs_per_100g: Number(foodCarbs),
        fats_per_100g: Number(foodFats),
        calories_per_100g: Number(foodCalories)
      });
      setFoodName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear alimento");
    }
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
        <h2>Dieta</h2>
        <p>
          Registro por dia con calculo de macros y calorias. La base inicial de alimentos es manual y las recetas son
          escalables por raciones.
        </p>
        {error && <p style={{ color: "#a53e2b" }}>{error}</p>}
      </div>

      <div className="grid two">
        <form className="panel" onSubmit={handleCreateDiet} style={{ display: "grid", gap: ".6rem" }}>
          <h3>Nueva dieta diaria</h3>
          <input type="date" value={dietDate} onChange={(event) => setDietDate(event.target.value)} required />
          <input value={dietName} onChange={(event) => setDietName(event.target.value)} required />
          <button type="submit">Crear dia</button>
        </form>

        <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h3>Dias guardados</h3>
          <div className="list">
            {dailyDiets.length === 0 && <p>No hay dietas todavia.</p>}
            {dailyDiets.map((diet) => (
              <article className="item" key={diet.id}>
                <strong>{diet.name}</strong>
                <p style={{ margin: "0.2rem 0" }}>{diet.diet_date}</p>
                <div className="pill">Fase: {diet.phase ?? "sin definir"}</div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid two">
        <form className="panel" onSubmit={handleCreateFood} style={{ display: "grid", gap: ".6rem" }}>
          <h3>Nuevo alimento manual</h3>
          <input placeholder="Nombre" value={foodName} onChange={(event) => setFoodName(event.target.value)} required />
          <div className="row">
            <input
              type="number"
              step="0.1"
              placeholder="Proteina/100g"
              value={foodProtein}
              onChange={(event) => setFoodProtein(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Carbs/100g"
              value={foodCarbs}
              onChange={(event) => setFoodCarbs(event.target.value)}
            />
          </div>
          <div className="row">
            <input
              type="number"
              step="0.1"
              placeholder="Grasas/100g"
              value={foodFats}
              onChange={(event) => setFoodFats(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Calorias/100g"
              value={foodCalories}
              onChange={(event) => setFoodCalories(event.target.value)}
            />
          </div>
          <button type="submit">Guardar alimento</button>
        </form>

        <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h3>Alimentos creados</h3>
          <div className="list">
            {foods.length === 0 && <p>No hay alimentos aun.</p>}
            {foods.map((food) => (
              <article className="item" key={food.id}>
                <strong>{food.name}</strong>
                <p style={{ margin: "0.2rem 0" }}>
                  P:{food.protein_per_100g} C:{food.carbs_per_100g} G:{food.fats_per_100g} kcal:{food.calories_per_100g}
                </p>
                <div className="row">
                  <button className="secondary">Foto plato para estimar</button>
                  <button className="secondary">Usar en receta</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
