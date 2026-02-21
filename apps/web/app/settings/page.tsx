"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, hasAuthToken } from "../../lib/api";
import { cancelAccountDelete, getAccountStatus, listDataExports, requestAccountDelete, requestDataExport, type AccountStatus, type ExportRequest } from "../../lib/account";
import { getMe, logout, type AuthUser } from "../../lib/auth";
import { getActiveGoal, upsertActiveGoal, type Goal, type GoalDomain } from "../../lib/goals";
import { enqueueSyncOperation } from "../../lib/sync";

const domainOptions: Array<{ value: GoalDomain; label: string }> = [
  { value: "training", label: "Entrenamiento" },
  { value: "diet", label: "Dieta" },
  { value: "body", label: "Corporal" },
  { value: "wellness", label: "Bienestar" },
];

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [exports, setExports] = useState<ExportRequest[]>([]);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDomain, setGoalDomain] = useState<GoalDomain>("training");
  const [goalTargetValue, setGoalTargetValue] = useState("");
  const [goalTargetUnit, setGoalTargetUnit] = useState("");

  const [tokenAvailable, setTokenAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingGoal, setSavingGoal] = useState(false);
  const [processingAccount, setProcessingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTokenAvailable(hasAuthToken());
  }, []);

  async function loadAll() {
    if (!tokenAvailable) {
      setUser(null);
      setGoal(null);
      setAccountStatus(null);
      setExports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [me, activeGoal, status, exportList] = await Promise.all([
        getMe(),
        getActiveGoal(),
        getAccountStatus(),
        listDataExports(),
      ]);

      setUser(me);
      setGoal(activeGoal);
      setAccountStatus(status);
      setExports(exportList);

      if (activeGoal) {
        setGoalTitle(activeGoal.title);
        setGoalDomain(activeGoal.domain);
        setGoalTargetValue(activeGoal.target_value !== null ? String(activeGoal.target_value) : "");
        setGoalTargetUnit(activeGoal.target_unit ?? "");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setError(err instanceof Error ? err.message : "No se pudo cargar ajustes.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [tokenAvailable]);

  const onLogout = () => {
    logout();
    setUser(null);
    window.location.href = "/auth/login";
  };

  const onSaveGoal = async () => {
    if (!goalTitle.trim()) {
      setError("El objetivo necesita un titulo.");
      return;
    }

    setSavingGoal(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await upsertActiveGoal({
        title: goalTitle.trim(),
        domain: goalDomain,
        target_value: goalTargetValue ? Number(goalTargetValue) : undefined,
        target_unit: goalTargetUnit.trim() || undefined,
      });
      setGoal(updated);
      enqueueSyncOperation({
        entityType: "goal_active",
        entityId: updated.id,
        opType: "upsert",
        payload: { title: updated.title, domain: updated.domain },
      });
      setMessage("Objetivo guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar objetivo.");
    } finally {
      setSavingGoal(false);
    }
  };

  const onRequestDelete = async () => {
    if (!window.confirm("¿Solicitar borrado de cuenta con gracia de 30 dias?")) return;

    setProcessingAccount(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await requestAccountDelete(30);
      setAccountStatus(updated);
      enqueueSyncOperation({
        entityType: "account_status",
        entityId: updated.user_id,
        opType: "upsert",
        payload: { account_status: updated.account_status, scheduled_delete_at: updated.scheduled_delete_at },
      });
      setMessage("Borrado solicitado. Puedes cancelarlo durante la gracia.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar borrado.");
    } finally {
      setProcessingAccount(false);
    }
  };

  const onCancelDelete = async () => {
    setProcessingAccount(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await cancelAccountDelete();
      setAccountStatus(updated);
      enqueueSyncOperation({
        entityType: "account_status",
        entityId: updated.user_id,
        opType: "upsert",
        payload: { account_status: updated.account_status },
      });
      setMessage("Solicitud de borrado cancelada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar borrado.");
    } finally {
      setProcessingAccount(false);
    }
  };

  const onRequestExport = async () => {
    setProcessingAccount(true);
    setError(null);
    setMessage(null);

    try {
      await requestDataExport();
      const exportList = await listDataExports();
      setExports(exportList);
      setMessage("Export solicitado y preparado en backend.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar export.");
    } finally {
      setProcessingAccount(false);
    }
  };

  return (
    <>
      <p className="page-subtitle">Configuracion</p>
      <h1 className="page-title">Ajustes</h1>

      {error ? <p className="status-message error">{error}</p> : null}
      {message ? <p className="status-message ok">{message}</p> : null}

      <section className="section-card">
        <div className="row section-heading-wrap">
          <div>
            <h3 className="info-title">Sesion</h3>
            {loading ? (
              <p className="info-text">Comprobando sesion...</p>
            ) : user ? (
              <p className="info-text">
                {user.email} • {user.email_verified_at ? "email verificado" : "email sin verificar"}
              </p>
            ) : (
              <p className="info-text">No has iniciado sesion.</p>
            )}
          </div>
          <div className="routine-actions">
            {user ? (
              <>
                <Link href="/auth/verify-email" className="action-pill">
                  Verificar email
                </Link>
                <button className="action-pill danger" onClick={onLogout}>
                  Cerrar sesion
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="action-pill">
                  Iniciar sesion
                </Link>
                <Link href="/auth/register" className="action-pill">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="row section-heading-wrap">
          <div>
            <h3 className="info-title">BYOK</h3>
            <p className="info-text">Configura tus claves de Anthropic, OpenAI y Google.</p>
          </div>
          <Link href="/settings/byok" className="cta cta-link">
            Abrir BYOK
          </Link>
        </div>
      </section>

      <section className="section-card">
        <h3 className="info-title">Objetivo activo</h3>
        <div className="stack-form">
          <input className="set-input" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Ejemplo: bajar grasa manteniendo fuerza" />
          <div className="grid-3">
            <label className="form-label">
              Dominio
              <select className="set-input" value={goalDomain} onChange={(event) => setGoalDomain(event.target.value as GoalDomain)}>
                {domainOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Valor objetivo
              <input className="set-input" value={goalTargetValue} onChange={(event) => setGoalTargetValue(event.target.value)} placeholder="ej. 78" />
            </label>
            <label className="form-label">
              Unidad
              <input className="set-input" value={goalTargetUnit} onChange={(event) => setGoalTargetUnit(event.target.value)} placeholder="kg, % grasa..." />
            </label>
          </div>
          <div className="row">
            <button className="cta" onClick={onSaveGoal} disabled={savingGoal}>
              {savingGoal ? "Guardando..." : "Guardar objetivo"}
            </button>
            {goal ? <p className="routine-meta">Ultima actualizacion: {new Date(goal.updated_at).toLocaleString("es-ES")}</p> : null}
          </div>
        </div>
      </section>

      <section className="section-card">
        <h3 className="info-title">Cuenta y privacidad</h3>
        <p className="info-text">
          Estado: {accountStatus?.account_status ?? "sin datos"}
          {accountStatus?.scheduled_delete_at ? ` • Borrado programado: ${new Date(accountStatus.scheduled_delete_at).toLocaleString("es-ES")}` : ""}
        </p>
        <div className="routine-actions" style={{ marginTop: "12px" }}>
          <button className="action-pill" onClick={onRequestExport} disabled={processingAccount}>Solicitar export</button>
          {accountStatus?.account_status === "pending_delete" ? (
            <button className="action-pill" onClick={onCancelDelete} disabled={processingAccount}>Cancelar borrado</button>
          ) : (
            <button className="action-pill danger" onClick={onRequestDelete} disabled={processingAccount}>Solicitar borrado</button>
          )}
        </div>
        <div className="stack-form">
          {exports.map((entry) => (
            <article key={entry.id} className="info-card">
              <p className="info-title">Export {entry.id.slice(0, 8)}</p>
              <p className="routine-meta">Estado: {entry.status}</p>
              <p className="routine-meta">Path: {entry.export_path ?? "-"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <h3 className="info-title">Estado IA</h3>
        <p className="info-text">
          Si no configuras claves BYOK, la app seguirá funcionando en entrenamiento/dieta/medidas sin funciones IA.
        </p>
      </section>
    </>
  );
}
