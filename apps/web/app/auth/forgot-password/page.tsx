"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ApiError } from "../../../lib/api";
import { forgotPassword, resetPassword } from "../../../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSendRecovery(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await forgotPassword(email);
      setMessage(response.message || "Solicitud enviada.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("No se pudo procesar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  async function onResetDirect(event: FormEvent) {
    event.preventDefault();
    setResetting(true);
    setMessage(null);
    setError(null);

    try {
      await resetPassword(email, newPassword);
      setMessage("Password actualizado.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("No se pudo actualizar password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <p className="page-subtitle">Recuperacion</p>
      <h1 className="auth-title">Recuperar contraseña</h1>

      <form className="auth-form" onSubmit={onSendRecovery}>
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
          />
        </label>

        <button className="tag auth-tag" disabled={sending}>
          {sending ? "Enviando..." : "Enviar instrucciones"}
        </button>
      </form>

      <form className="auth-form" onSubmit={onResetDirect}>
        <label className="auth-label">
          Nuevo password (modo v1 directo)
          <input
            className="auth-input"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Minimo 8 caracteres"
          />
        </label>

        <button className="cta auth-cta" disabled={resetting}>
          {resetting ? "Actualizando..." : "Actualizar password"}
        </button>
      </form>

      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <div className="auth-links">
        <Link href="/auth/login">Volver al login</Link>
      </div>
    </>
  );
}
