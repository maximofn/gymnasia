"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ApiError, hasAuthToken } from "../../lib/api";
import { createUploadIntent } from "../../lib/media";
import {
  createMeasurement,
  deleteMeasurement,
  listMeasurements,
  type BodyMeasurement,
  type BodyMeasurementInput,
} from "../../lib/measurements";
import { enqueueSyncOperation } from "../../lib/sync";

const LOCAL_MEASUREMENTS_KEY = "gimnasia_measurements";

type CircumferenceKey = "neck" | "chest" | "waist" | "hip" | "arm" | "thigh";

const circumferenceLabels: Record<CircumferenceKey, string> = {
  neck: "Cuello",
  chest: "Pecho",
  waist: "Cintura",
  hip: "Cadera",
  arm: "Brazo",
  thigh: "Muslo",
};

function parseNumberInput(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function readLocalMeasurements(): BodyMeasurement[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LOCAL_MEASUREMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BodyMeasurement[];
    return parsed.sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at));
  } catch {
    return [];
  }
}

function writeLocalMeasurements(entries: BodyMeasurement[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_MEASUREMENTS_KEY, JSON.stringify(entries));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeasurementsPage() {
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenAvailable, setTokenAvailable] = useState(false);

  const [measuredAt, setMeasuredAt] = useState<string>(() => toDateTimeLocal(new Date().toISOString()));
  const [weightKg, setWeightKg] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [photoAssetId, setPhotoAssetId] = useState<string | null>(null);
  const [attachingPhoto, setAttachingPhoto] = useState(false);
  const [circumferences, setCircumferences] = useState<Record<CircumferenceKey, string>>({
    neck: "",
    chest: "",
    waist: "",
    hip: "",
    arm: "",
    thigh: "",
  });

  useEffect(() => {
    setTokenAvailable(hasAuthToken());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEntries() {
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const remote = await listMeasurements(100);
        if (mounted) {
          setEntries(remote);
        }
      } catch (err) {
        if (!mounted) return;

        const local = readLocalMeasurements();
        setEntries(local);

        if (err instanceof ApiError && err.status === 401) {
          setMessage("Modo local: añade token para sincronizar medidas.");
        } else {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las medidas.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadEntries();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    writeLocalMeasurements(entries);
  }, [entries]);

  const summary = useMemo(() => {
    const latest = entries[0] ?? null;
    const previous = entries[1] ?? null;

    const weightLatest = latest?.weight_kg ?? null;
    const weightDelta =
      latest?.weight_kg !== null && latest?.weight_kg !== undefined && previous?.weight_kg !== null && previous?.weight_kg !== undefined
        ? latest.weight_kg - previous.weight_kg
        : null;

    return {
      latest,
      weightLatest,
      weightDelta,
    };
  }, [entries]);

  const resetForm = () => {
    setMeasuredAt(toDateTimeLocal(new Date().toISOString()));
    setWeightKg("");
    setNotes("");
    setPhotoAssetId(null);
    setCircumferences({
      neck: "",
      chest: "",
      waist: "",
      hip: "",
      arm: "",
      thigh: "",
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const payloadCircumferences: Record<string, number> = {};
    (Object.keys(circumferences) as CircumferenceKey[]).forEach((key) => {
      const parsed = parseNumberInput(circumferences[key]);
      if (parsed !== null) {
        payloadCircumferences[key] = parsed;
      }
    });

    const payload: BodyMeasurementInput = {
      measured_at: measuredAt ? new Date(measuredAt).toISOString() : undefined,
      weight_kg: parseNumberInput(weightKg) ?? undefined,
      circumferences_cm: payloadCircumferences,
      notes: notes.trim() ? notes.trim() : undefined,
      photo_asset_id: photoAssetId ?? undefined,
    };

    try {
      const created = await createMeasurement(payload);
      setEntries((prev) => [created, ...prev]);
      enqueueSyncOperation({
        entityType: "measurement",
        entityId: created.id,
        opType: "upsert",
        payload: { measured_at: created.measured_at },
      });
      setMessage("Medicion registrada.");
      resetForm();
    } catch (err) {
      const localEntry: BodyMeasurement = {
        id: `local-${Date.now()}`,
        measured_at: payload.measured_at ?? new Date().toISOString(),
        weight_kg: payload.weight_kg ?? null,
        circumferences_cm: payload.circumferences_cm ?? {},
        notes: payload.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEntries((prev) => [localEntry, ...prev]);

      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: medicion guardada en local.");
        resetForm();
      } else {
        setError(err instanceof Error ? err.message : "No se pudo registrar la medicion.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (entry: BodyMeasurement) => {
    if (!window.confirm("¿Eliminar esta medicion?")) return;

    setError(null);

    try {
      await deleteMeasurement(entry.id);
      enqueueSyncOperation({
        entityType: "measurement",
        entityId: entry.id,
        opType: "delete",
      });
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      if (entry.id.startsWith("local-")) {
        setEntries((prev) => prev.filter((item) => item.id !== entry.id));
        return;
      }

      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: no se pudo borrar en servidor.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo borrar la medicion.");
      }
    }
  };

  const attachMeasurementPhoto = async () => {
    setAttachingPhoto(true);
    setError(null);
    setMessage(null);
    try {
      const intent = await createUploadIntent("measurement_photo", `measurement-${Date.now()}.jpg`);
      setPhotoAssetId(intent.asset.id);
      setMessage("Foto de medicion vinculada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo adjuntar foto.");
    } finally {
      setAttachingPhoto(false);
    }
  };

  return (
    <>
      <p className="page-subtitle">Seguimiento corporal</p>
      <h1 className="page-title">Medidas</h1>

      {!tokenAvailable ? <p className="status-message ok">Modo local activo (sin sesion).</p> : null}
      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <section className="grid-3">
        <article className="stat-card">
          <p className="stat-label">Peso actual</p>
          <p className="stat-value">{summary.weightLatest !== null ? `${summary.weightLatest.toFixed(2)} kg` : "-"}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Cambio ultimo registro</p>
          <p className={summary.weightDelta !== null && summary.weightDelta <= 0 ? "stat-value value-success" : "stat-value"}>
            {summary.weightDelta !== null ? `${summary.weightDelta > 0 ? "+" : ""}${summary.weightDelta.toFixed(2)} kg` : "-"}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Ultimo registro</p>
          <p className="stat-value small">{summary.latest ? formatDateTime(summary.latest.measured_at) : "Sin datos"}</p>
        </article>
      </section>

      <section className="section-card">
        <h3 className="info-title">Registrar medicion</h3>
        <form className="stack-form" onSubmit={onSubmit}>
          <div className="grid-2">
            <label className="form-label">
              Fecha y hora
              <input
                className="set-input"
                type="datetime-local"
                value={measuredAt}
                onChange={(event) => setMeasuredAt(event.target.value)}
              />
            </label>
            <label className="form-label">
              Peso (kg)
              <input
                className="set-input"
                type="number"
                step="0.01"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
              />
            </label>
          </div>

          <div className="grid-3">
            {(Object.keys(circumferences) as CircumferenceKey[]).map((key) => (
              <label key={key} className="form-label">
                {circumferenceLabels[key]} (cm)
                <input
                  className="set-input"
                  type="number"
                  step="0.1"
                  value={circumferences[key]}
                  onChange={(event) =>
                    setCircumferences((prev) => ({
                      ...prev,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <label className="form-label">
            Notas
            <textarea
              className="text-area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ejemplo: me vi con mas energia, mejor tecnica, etc."
            />
          </label>

          <div className="row">
            <button className="tag" type="button" onClick={attachMeasurementPhoto} disabled={attachingPhoto}>
              {attachingPhoto ? "Vinculando foto..." : photoAssetId ? "Foto vinculada" : "Adjuntar foto"}
            </button>
            <button className="cta" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Registrar medicion"}
            </button>
          </div>
        </form>
      </section>

      <section className="builder-list">
        <h3 className="info-title">Historial</h3>

        {loading ? (
          <div className="state-loading-list" style={{ marginTop: "16px" }}>
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : entries.length === 0 ? (
          <p className="state-text" style={{ marginTop: "8px" }}>
            Aún no tienes mediciones.
          </p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="builder-exercise-card">
              <div className="row routine-row-wrap">
                <div>
                  <h3 className="routine-title">{formatDateTime(entry.measured_at)}</h3>
                  <p className="routine-meta">
                    Peso: {entry.weight_kg !== null ? `${entry.weight_kg.toFixed(2)} kg` : "-"}
                  </p>
                  <p className="routine-meta">
                    {(Object.entries(entry.circumferences_cm) as Array<[string, number]>).length > 0
                      ? (Object.entries(entry.circumferences_cm) as Array<[string, number]>)
                          .map(([key, value]) => `${key}: ${value.toFixed(1)} cm`)
                          .join(" • ")
                      : "Sin contornos"}
                  </p>
                  {entry.notes ? <p className="routine-meta">Notas: {entry.notes}</p> : null}
                  {entry.photo_asset_id ? <p className="routine-meta">Foto: vinculada</p> : null}
                </div>
                <div className="routine-actions">
                  <button className="action-pill danger" onClick={() => onDelete(entry)}>
                    Borrar
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
