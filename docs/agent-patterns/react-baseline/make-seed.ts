// Genera los datos inventados de partida de la batería de tareas de referencia.
// Uso (desde la raíz): node_modules/.bin/tsx docs/agent-patterns/react-baseline/make-seed.ts 2026-11-25 > seed.json
import { createInitialStore, normalizeStore } from "../../../apps/mobile/persistence/localStoreModel";
import { validateLocalStoreTree } from "../../../apps/mobile/persistence/localStoreRecovery";
import {
  buildWorkoutPrescriptionSnapshot,
  summarizeWorkoutPrescriptionSnapshot,
} from "../../../apps/mobile/training/workoutHistory";

const today = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) throw new Error("Falta la fecha de hoy (AAAA-MM-DD)");
const day = (offset: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let seq = 0;
const id = (p: string) => `${p}_seed_${String(++seq).padStart(4, "0")}`;

// ---------- Rutinas ----------
type Ex = { name: string; muscle: string; series: Array<[number, number]> };
const ex = (name: string, muscle: string, reps: number, kg: number, n = 3): Ex =>
  ({ name, muscle, series: Array.from({ length: n }, () => [reps, kg] as [number, number]) });
const tpl = (tid: string, name: string, category: string, exercises: Ex[]) => ({
  id: tid, name, category, icon: "activity", duration_minutes: "60",
  exercises: exercises.map((e) => ({
    id: id("ex"), name: e.name, muscle: e.muscle, image_uri: null,
    series: e.series.map(([reps, kg]) => ({ id: id("set"), reps: String(reps), weight_kg: String(kg), rest_seconds: "90" })),
  })),
});
const empuje = tpl("tpl_seed_empuje", "Empuje", "strength", [
  ex("Press banca", "pecho", 8, 70, 4), ex("Press militar", "hombro", 10, 40),
  ex("Fondos en paralelas", "tríceps", 10, 0), ex("Elevaciones laterales", "hombro", 15, 8),
]);
const pierna = tpl("tpl_seed_pierna", "Pierna", "strength", [
  ex("Sentadilla", "cuádriceps", 8, 90, 4), ex("Peso muerto rumano", "isquiotibiales", 10, 70),
  ex("Zancadas", "glúteo", 12, 16), ex("Elevación de gemelos", "gemelos", 15, 40),
]);
const torso = tpl("tpl_seed_torso", "Torso completo", "hypertrophy", [
  ex("Press inclinado con mancuernas", "pecho", 10, 24), ex("Remo con barra", "espalda", 10, 60),
  ex("Jalón al pecho", "espalda", 12, 55), ex("Curl bíceps", "bíceps", 12, 14),
]);
const templates = [empuje, pierna, torso];

// ---------- Historial: 4 semanas, progresión en press banca ----------
const sessions: Array<[number, typeof empuje, number]> = [
  // [días desde hoy, rutina, kg de press banca]
  [-27, empuje, 65], [-25, pierna, 0], [-23, torso, 0],
  [-20, empuje, 67.5], [-18, pierna, 0], [-16, torso, 0],
  [-13, empuje, 67.5], [-11, pierna, 0], [-9, torso, 0],
  [-6, empuje, 70], [-4, pierna, 0], [-2, torso, 0],
];
const workoutHistory = sessions.map(([offset, template, bench]) => {
  const t = JSON.parse(JSON.stringify(template));
  if (bench) t.exercises[0].series.forEach((s: { weight_kg: string }) => { s.weight_kg = String(bench); });
  const snapshot = buildWorkoutPrescriptionSnapshot(t, []);
  snapshot.exercises.forEach((e) => e.series.forEach((s) => { s.completed = true; }));
  const sum = summarizeWorkoutPrescriptionSnapshot(snapshot);
  return {
    id: id("session_summary"), template_id: t.id, template_name: t.name,
    finished_at: `${day(offset)}T19:00:00.000Z`, elapsed_seconds: 3300,
    summary_schema_version: 2, calculation_version: 2, prescription_snapshot: snapshot,
    completed_effort_count: sum.completedEffortCount, total_effort_count: sum.totalEffortCount,
    effort_breakdown: sum.effortBreakdown, estimated_calories: 380,
    total_volume_kg: sum.totalVolumeKg, total_reps: sum.totalReps,
  };
});

// ---------- Dieta: 7 días hasta ayer + desayuno de hoy ----------
// kcal, proteína, hidratos, grasa por 100 g
const FOOD: Record<string, [number, number, number, number]> = {
  "Copos de avena": [372, 13.5, 58.7, 7],
  "Leche semidesnatada": [46, 3.2, 4.7, 1.6],
  "Zumo de naranja": [45, 0.7, 10.4, 0.2],
  "Pechuga de pollo": [110, 23, 0, 1.9],
  "Arroz blanco cocido": [130, 2.7, 28, 0.3],
  "Brócoli": [34, 2.8, 7, 0.4],
  "Huevo": [143, 12.6, 0.7, 9.5],
  "Pan integral": [247, 13, 41, 3.4],
  "Plátano": [89, 1.1, 22.8, 0.3],
  "Salmón": [208, 20, 0, 13],
  "Patata cocida": [87, 1.9, 20, 0.1],
  "Yogur natural": [61, 3.5, 4.7, 3.3],
  "Nueces": [654, 15, 14, 65],
  "Lentejas cocidas": [116, 9, 20, 0.4],
  "Aceite de oliva": [884, 0, 0, 100],
};
const item = (title: string, grams: number) => {
  const [k, p, c, f] = FOOD[title];
  const r = (v: number) => Math.round(v * grams) / 100;
  return { id: id("item"), title, grams, calories_kcal: Math.round(k * grams / 100), protein_g: r(p), carbs_g: r(c), fat_g: r(f) };
};
const meal = (title: string, items: Array<[string, number]>) =>
  ({ id: id("meal"), title, items: items.map(([t, g]) => item(t, g)) });
const desayuno = () => meal("Desayuno", [["Copos de avena", 100], ["Leche semidesnatada", 250], ["Zumo de naranja", 200]]);
const fullDay = (variant: number) => [
  desayuno(),
  variant % 2 === 0
    ? meal("Comida", [["Pechuga de pollo", 150], ["Arroz blanco cocido", 200], ["Brócoli", 150], ["Aceite de oliva", 10]])
    : meal("Comida", [["Lentejas cocidas", 300], ["Pan integral", 60], ["Aceite de oliva", 10]]),
  meal("Merienda", [["Plátano", 120], ["Nueces", 20]]),
  variant % 3 === 0
    ? meal("Cena", [["Salmón", 150], ["Patata cocida", 200]])
    : meal("Cena", [["Huevo", 120], ["Pan integral", 60], ["Yogur natural", 125]]),
];
const dietByDate: Record<string, { day_date: string; meals: unknown[] }> = {};
for (let offset = -7; offset <= -1; offset += 1) {
  dietByDate[day(offset)] = { day_date: day(offset), meals: fullDay(offset + 7) };
}
// Hoy: solo el desayuno, con 100 g de avena y zumo (tarea 7), merienda y cena vacías
dietByDate[day(0)] = { day_date: day(0), meals: [
  desayuno(), { id: id("meal"), title: "Comida", items: [] },
  { id: id("meal"), title: "Merienda", items: [] }, { id: id("meal"), title: "Cena", items: [] },
] };

const dietSettings = {
  goal: "cut", activity_level: "intermediate", sex: "male", height_cm: "178", birth_date: "1990-04-12",
  daily_calories: "2300", macro_mode: "gkg",
  manual_macro_calories: { carbs: "", protein: "", fat: "" },
  protein_grams_per_kg: "2", carbs_grams_per_kg: "3", fat_grams_per_kg: "0.9",
};

// ---------- Medidas: bajada suave de 81,2 a 78,9 kg en 5 semanas ----------
const measurements = [
  [-35, 81.2, 88], [-28, 80.6, 87], [-21, 80.1, 86], [-14, 79.6, 85.5], [-7, 79.3, 85], [-2, 78.9, 84.5],
].map(([offset, weight, waist]) => ({
  id: id("measurement"), measured_on: day(offset), measured_at: `${day(offset)}T08:00:00.000Z`,
  weight_kg: weight, body_fat_pct: null, photo_uri: null, neck_cm: null, chest_cm: null,
  waist_cm: waist, hips_cm: null, biceps_cm: null, quadriceps_cm: null, calf_cm: null, height_cm: 178,
}));

const seed = { templates, workoutHistory, dietByDate, dietSettings, measurements };

// Validación con el código real de la app
const base = createInitialStore();
const candidate = { ...base, ...seed } as never;
const issues = validateLocalStoreTree(candidate);
if (issues.length) { console.error(JSON.stringify(issues, null, 1)); process.exit(1); }
const normalized = normalizeStore(candidate, { training: "strict" });
for (const k of Object.keys(seed) as Array<keyof typeof seed>) {
  const a = JSON.stringify((normalized as Record<string, unknown>)[k]);
  void a;
}
const n = normalized as unknown as Record<string, unknown>;
process.stdout.write(JSON.stringify({ today, seed: Object.fromEntries(Object.keys(seed).map((k) => [k, n[k]])) }));
