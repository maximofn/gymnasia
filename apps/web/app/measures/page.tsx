"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, BodyMeasurement } from "@/lib/api";

export default function MeasuresPage() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [chest, setChest] = useState("");
  const [arm, setArm] = useState("");
  const [thigh, setThigh] = useState("");

  async function loadData() {
    try {
      const data = await api.listBodyMeasurements();
      setMeasurements(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar medidas");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createBodyMeasurement({
        measured_at: date,
        weight_kg: weight ? Number(weight) : undefined,
        body_fat_pct: bodyFat ? Number(bodyFat) : undefined,
        waist_cm: waist ? Number(waist) : undefined,
        hip_cm: hip ? Number(hip) : undefined,
        chest_cm: chest ? Number(chest) : undefined,
        arm_cm: arm ? Number(arm) : undefined,
        thigh_cm: thigh ? Number(thigh) : undefined
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar medida");
    }
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
        <h2>Medidas</h2>
        <p>Peso, porcentajes y contornos con historico. Las fotos de progreso se gestionan en el backend/storage.</p>
        {error && <p style={{ color: "#a53e2b" }}>{error}</p>}
      </div>

      <div className="grid two">
        <form className="panel" onSubmit={handleSubmit} style={{ display: "grid", gap: ".6rem" }}>
          <h3>Nuevo registro</h3>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <div className="row">
            <input
              type="number"
              step="0.1"
              placeholder="Peso (kg)"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="% grasa"
              value={bodyFat}
              onChange={(event) => setBodyFat(event.target.value)}
            />
          </div>
          <div className="row">
            <input
              type="number"
              step="0.1"
              placeholder="Cintura"
              value={waist}
              onChange={(event) => setWaist(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Cadera"
              value={hip}
              onChange={(event) => setHip(event.target.value)}
            />
          </div>
          <div className="row">
            <input
              type="number"
              step="0.1"
              placeholder="Pecho"
              value={chest}
              onChange={(event) => setChest(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Brazo"
              value={arm}
              onChange={(event) => setArm(event.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Muslo"
              value={thigh}
              onChange={(event) => setThigh(event.target.value)}
            />
          </div>
          <button type="submit">Guardar medida</button>
        </form>

        <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h3>Historico</h3>
          <div className="list">
            {measurements.length === 0 && <p>No hay medidas guardadas.</p>}
            {measurements.map((measurement) => (
              <article className="item" key={measurement.id}>
                <strong>{measurement.measured_at}</strong>
                <p style={{ margin: "0.2rem 0" }}>
                  Peso: {measurement.weight_kg ?? "-"} kg | % grasa: {measurement.body_fat_pct ?? "-"}
                </p>
                <div className="pill">Seguimiento corporal</div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
