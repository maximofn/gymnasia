"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError, hasAuthToken } from "../../../lib/api";
import {
  deleteAIKey,
  listAIKeys,
  rotateAIKey,
  testAIKey,
  upsertAIKey,
  type AIKeyRecord,
  type AIProvider,
} from "../../../lib/ai-keys";
import { enqueueSyncOperation } from "../../../lib/sync";

const providers: Array<{ id: AIProvider; label: string }> = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
];

function providerMap(records: AIKeyRecord[]): Record<AIProvider, AIKeyRecord | null> {
  return {
    anthropic: records.find((item) => item.provider === "anthropic") ?? null,
    openai: records.find((item) => item.provider === "openai") ?? null,
    google: records.find((item) => item.provider === "google") ?? null,
  };
}

export default function ByokPage() {
  const [records, setRecords] = useState<AIKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<AIProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null);
  const [inputs, setInputs] = useState<Record<AIProvider, string>>({
    anthropic: "",
    openai: "",
    google: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenAvailable, setTokenAvailable] = useState(false);
  const byProvider = useMemo(() => providerMap(records), [records]);

  useEffect(() => {
    setTokenAvailable(hasAuthToken());
  }, []);

  async function loadKeys() {
    if (!tokenAvailable) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await listAIKeys();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar BYOK.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, [tokenAvailable]);

  const saveKey = async (provider: AIProvider) => {
    const value = inputs[provider].trim();
    if (value.length < 10) {
      setError("La API key debe tener al menos 10 caracteres.");
      return;
    }

    setSavingProvider(provider);
    setError(null);
    setMessage(null);

    try {
      const existing = byProvider[provider];
      const saved = existing ? await rotateAIKey(provider, value) : await upsertAIKey(provider, value);

      setRecords((prev) => {
        const other = prev.filter((item) => item.provider !== provider);
        return [...other, saved];
      });
      enqueueSyncOperation({
        entityType: "ai_key",
        entityId: provider,
        opType: "upsert",
        payload: { provider, active: true },
      });

      setInputs((prev) => ({ ...prev, [provider]: "" }));
      setMessage(`Clave ${provider} guardada.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Necesitas iniciar sesion para guardar claves.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar la clave.");
      }
    } finally {
      setSavingProvider(null);
    }
  };

  const removeKey = async (provider: AIProvider) => {
    if (!window.confirm(`¿Eliminar la clave de ${provider}?`)) return;

    setError(null);
    setMessage(null);

    try {
      await deleteAIKey(provider);
      setRecords((prev) => prev.filter((item) => item.provider !== provider));
      enqueueSyncOperation({
        entityType: "ai_key",
        entityId: provider,
        opType: "delete",
      });
      setMessage(`Clave ${provider} eliminada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la clave.");
    }
  };

  const runTest = async (provider: AIProvider) => {
    setTestingProvider(provider);
    setError(null);
    setMessage(null);

    try {
      const response = await testAIKey(provider);
      setMessage(response.message);
      setRecords((prev) => {
        return prev.map((item) => {
          if (item.provider !== provider) return item;
          return {
            ...item,
            last_tested_at: response.tested_at,
          };
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo testear la clave.");
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <>
      <p className="page-subtitle">Configuracion</p>
      <h1 className="page-title">Ajustes BYOK</h1>

      {!tokenAvailable ? (
        <section className="state-card">
          <h3 className="state-title">Necesitas sesion iniciada</h3>
          <p className="state-text">Inicia sesion para cargar, guardar y testear tus API keys.</p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/auth/login" className="cta cta-link">
              Ir a login
            </Link>
          </div>
        </section>
      ) : null}

      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <section className="routine-list">
        {providers.map((provider) => {
          const record = byProvider[provider.id];
          const isSaving = savingProvider === provider.id;
          const isTesting = testingProvider === provider.id;

          return (
            <article key={provider.id} className="routine-item">
              <div className="row byok-row-wrap">
                <div className="byok-main">
                  <h3 className="routine-title">{provider.label}</h3>
                  <p className="routine-meta">
                    Estado: {record?.is_active ? "conectado" : "no conectado"}
                    {record?.key_fingerprint ? ` • ${record.key_fingerprint}` : ""}
                  </p>
                  <p className="routine-meta">
                    Ultimo test: {record?.last_tested_at ? new Date(record.last_tested_at).toLocaleString("es-ES") : "sin test"}
                  </p>
                </div>

                <div className="byok-actions">
                  <input
                    className="set-input byok-key-input"
                    type="password"
                    value={inputs[provider.id]}
                    onChange={(event) =>
                      setInputs((prev) => ({
                        ...prev,
                        [provider.id]: event.target.value,
                      }))
                    }
                    placeholder="Pega aqui tu API key"
                    disabled={!tokenAvailable || loading}
                  />

                  <div className="routine-actions">
                    <button
                      className="action-pill"
                      onClick={() => saveKey(provider.id)}
                      disabled={!tokenAvailable || isSaving || loading}
                    >
                      {isSaving ? "Guardando..." : record ? "Rotar" : "Añadir"}
                    </button>
                    <button
                      className="action-pill"
                      onClick={() => runTest(provider.id)}
                      disabled={!tokenAvailable || !record || isTesting || loading}
                    >
                      {isTesting ? "Testeando..." : "Test"}
                    </button>
                    <button
                      className="action-pill danger"
                      onClick={() => removeKey(provider.id)}
                      disabled={!tokenAvailable || !record || loading}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
