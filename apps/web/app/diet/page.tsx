"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError, hasAuthToken } from "../../lib/api";
import {
  defaultDietItem,
  emptyDietDay,
  getDietDay,
  getTodayISODate,
  sumDayCalories,
  upsertDietDay,
  type DietDay,
  type DietItem,
} from "../../lib/diet";
import { createUploadIntent, estimateDietFromPhoto } from "../../lib/media";
import { enqueueSyncOperation } from "../../lib/sync";

const LOCAL_DIET_PREFIX = "gimnasia_diet_day_";

function localDietKey(dayDate: string): string {
  return `${LOCAL_DIET_PREFIX}${dayDate}`;
}

function parseNumberInput(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function readLocalDay(dayDate: string): DietDay | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(localDietKey(dayDate));
    if (!raw) return null;
    return JSON.parse(raw) as DietDay;
  } catch {
    return null;
  }
}

function writeLocalDay(dayDate: string, day: DietDay): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(localDietKey(dayDate), JSON.stringify(day));
}

function normalizeDay(day: DietDay): DietDay {
  const withDefaultMeals = day.meals.length > 0 ? day.meals : emptyDietDay(day.day_date).meals;

  return {
    ...day,
    meals: withDefaultMeals.map((meal) => ({
      ...meal,
      title: meal.title ?? null,
      items: meal.items ?? [],
    })),
  };
}

function sumMacro(day: DietDay, macro: keyof Pick<DietItem, "protein_g" | "carbs_g" | "fat_g">): number {
  return day.meals.reduce((mealAcc, meal) => {
    return mealAcc + meal.items.reduce((itemAcc, item) => itemAcc + (item[macro] ?? 0), 0);
  }, 0);
}

export default function DietPage() {
  const [dayDate, setDayDate] = useState(getTodayISODate());
  const [day, setDay] = useState<DietDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimatingMealType, setEstimatingMealType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenAvailable, setTokenAvailable] = useState(false);

  useEffect(() => {
    setTokenAvailable(hasAuthToken());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDay() {
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const remoteDay = await getDietDay(dayDate);
        if (mounted) {
          if (remoteDay) {
            setDay(normalizeDay(remoteDay));
          } else {
            const localDay = readLocalDay(dayDate);
            setDay(localDay ? normalizeDay(localDay) : emptyDietDay(dayDate));
          }
        }
      } catch (err) {
        if (!mounted) return;

        const localDay = readLocalDay(dayDate);
        setDay(localDay ? normalizeDay(localDay) : emptyDietDay(dayDate));

        if (err instanceof ApiError && err.status === 401) {
          setMessage("Modo local: añade token para sincronizar dieta con servidor.");
        } else {
          setError(err instanceof Error ? err.message : "No se pudo cargar la dieta.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDay();

    return () => {
      mounted = false;
    };
  }, [dayDate]);

  useEffect(() => {
    if (!day) return;
    writeLocalDay(dayDate, day);
  }, [dayDate, day]);

  const totals = useMemo(() => {
    if (!day) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
    }

    return {
      calories: sumDayCalories(day),
      protein: sumMacro(day, "protein_g"),
      carbs: sumMacro(day, "carbs_g"),
      fat: sumMacro(day, "fat_g"),
    };
  }, [day]);

  const updateMealTitle = (mealIndex: number, title: string) => {
    setDay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((meal, index) => {
          if (index !== mealIndex) return meal;
          return { ...meal, title };
        }),
      };
    });
  };

  const addItem = (mealIndex: number) => {
    setDay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((meal, index) => {
          if (index !== mealIndex) return meal;
          return {
            ...meal,
            items: [...meal.items, defaultDietItem()],
          };
        }),
      };
    });
  };

  const removeItem = (mealIndex: number, itemIndex: number) => {
    setDay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((meal, index) => {
          if (index !== mealIndex) return meal;
          return {
            ...meal,
            items: meal.items.filter((_, idx) => idx !== itemIndex),
          };
        }),
      };
    });
  };

  const updateItem = (mealIndex: number, itemIndex: number, updater: (item: DietItem) => DietItem) => {
    setDay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((meal, index) => {
          if (index !== mealIndex) return meal;
          return {
            ...meal,
            items: meal.items.map((item, idx) => {
              if (idx !== itemIndex) return item;
              return updater(item);
            }),
          };
        }),
      };
    });
  };

  const saveDay = async () => {
    if (!day) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await upsertDietDay(dayDate, day);
      setDay(normalizeDay(saved));
      enqueueSyncOperation({
        entityType: "diet_day",
        entityId: dayDate,
        opType: "upsert",
        payload: { meals: day.meals.length },
      });
      setMessage("Dieta guardada.");
    } catch (err) {
      writeLocalDay(dayDate, day);
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: cambios guardados solo en local.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la dieta.");
      }
    } finally {
      setSaving(false);
    }
  };

  const estimateMealFromPhoto = async (mealType: string) => {
    if (!day) return;
    setEstimatingMealType(mealType);
    setError(null);
    setMessage(null);

    try {
      const kind = "diet_photo";
      const upload = await createUploadIntent(kind, `${mealType}-${dayDate}.jpg`);
      const estimated = await estimateDietFromPhoto({
        asset_id: upload.asset.id,
        day_date: dayDate,
        meal_type: mealType as "breakfast" | "lunch" | "snack" | "dinner" | "other",
      });

      setDay((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          meals: prev.meals.map((meal) => {
            if (meal.meal_type !== mealType) return meal;
            return {
              ...meal,
              items: [
                ...meal.items,
                {
                  ...estimated.item,
                },
              ],
            };
          }),
        };
      });
      enqueueSyncOperation({
        entityType: "diet_photo_estimate",
        entityId: estimated.item.id,
        opType: "upsert",
        payload: { day_date: dayDate, meal_type: mealType, confidence: estimated.confidence_percent },
      });
      setMessage(`Estimacion IA añadida (${estimated.confidence_percent.toFixed(1)}% confianza).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo estimar por foto.");
    } finally {
      setEstimatingMealType(null);
    }
  };

  if (loading || !day) {
    return (
      <>
        <p className="page-subtitle">Nutricion</p>
        <h1 className="page-title">Dieta del Dia</h1>
        <section className="state-card">
          <h3 className="state-title">Cargando dieta...</h3>
          <div className="state-loading-list">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="row page-heading-wrap">
        <div>
          <p className="page-subtitle">Nutricion</p>
          <h1 className="page-title">Dieta del Dia</h1>
        </div>
        <div className="row page-controls">
          <label className="inline-label" htmlFor="diet-day-date">
            Fecha
          </label>
          <input
            id="diet-day-date"
            className="builder-input inline-date"
            type="date"
            value={dayDate}
            onChange={(event) => setDayDate(event.target.value)}
          />
          <button className="cta" onClick={saveDay} disabled={saving}>
            {saving ? "Guardando..." : "Guardar dia"}
          </button>
        </div>
      </div>

      {!tokenAvailable ? <p className="status-message ok">Modo local activo (sin sesion).</p> : null}
      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <section className="grid-4 nutrition-kpi-grid">
        <article className="stat-card">
          <p className="stat-label">Calorias</p>
          <p className="stat-value small">{totals.calories.toFixed(0)} kcal</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Proteina</p>
          <p className="stat-value small">{totals.protein.toFixed(1)} g</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Carbohidratos</p>
          <p className="stat-value small">{totals.carbs.toFixed(1)} g</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Grasas</p>
          <p className="stat-value small">{totals.fat.toFixed(1)} g</p>
        </article>
      </section>

      <section className="builder-list">
        {day.meals.map((meal, mealIndex) => (
          <article key={`${meal.meal_type}-${mealIndex}`} className="builder-exercise-card">
            <div className="row meal-header">
              <input
                className="builder-input title"
                value={meal.title ?? ""}
                onChange={(event) => updateMealTitle(mealIndex, event.target.value)}
                placeholder="Nombre de comida"
              />
              <div className="routine-actions">
                <button className="tag" onClick={() => addItem(mealIndex)}>
                  Añadir item
                </button>
                <button
                  className="tag"
                  onClick={() => estimateMealFromPhoto(meal.meal_type)}
                  disabled={estimatingMealType === meal.meal_type}
                >
                  {estimatingMealType === meal.meal_type ? "Estimando..." : "Estimar por foto"}
                </button>
              </div>
            </div>

            <div className="diet-table">
              <div className="diet-grid-head">
                <span>Comida</span>
                <span>Gr</span>
                <span>Kcal</span>
                <span>P</span>
                <span>C</span>
                <span>G</span>
                <span />
              </div>

              {meal.items.length === 0 ? (
                <p className="muted">Sin items todavía.</p>
              ) : (
                meal.items.map((item, itemIndex) => (
                  <div key={`${meal.meal_type}-${itemIndex}`} className="diet-grid-row">
                    <input
                      className="set-input"
                      value={item.name}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Arroz, pollo, fruta..."
                    />
                    <input
                      className="set-input"
                      type="number"
                      step="0.1"
                      value={item.grams ?? ""}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          grams: parseNumberInput(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="set-input"
                      type="number"
                      step="0.1"
                      value={item.calories_kcal ?? ""}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          calories_kcal: parseNumberInput(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="set-input"
                      type="number"
                      step="0.1"
                      value={item.protein_g ?? ""}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          protein_g: parseNumberInput(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="set-input"
                      type="number"
                      step="0.1"
                      value={item.carbs_g ?? ""}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          carbs_g: parseNumberInput(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="set-input"
                      type="number"
                      step="0.1"
                      value={item.fat_g ?? ""}
                      onChange={(event) =>
                        updateItem(mealIndex, itemIndex, (current) => ({
                          ...current,
                          fat_g: parseNumberInput(event.target.value),
                        }))
                      }
                    />
                    <button className="action-pill danger" onClick={() => removeItem(mealIndex, itemIndex)}>
                      Borrar
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="section-card">
        <h3 className="info-title">Notas del dia</h3>
        <textarea
          className="text-area"
          rows={4}
          value={day.notes ?? ""}
          onChange={(event) =>
            setDay((prev) => {
              if (!prev) return prev;
              return { ...prev, notes: event.target.value };
            })
          }
          placeholder="Sensaciones, hambre, adherencia, etc."
        />
      </section>
    </>
  );
}
