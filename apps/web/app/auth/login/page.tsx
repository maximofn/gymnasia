"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ApiError } from "../../../lib/api";
import { login } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo iniciar sesion.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="page-subtitle">Acceso</p>
      <h1 className="auth-title">Iniciar sesion</h1>
      <form className="auth-form" onSubmit={onSubmit}>
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

        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
        </label>

        {error ? <p className="status-message error">{error}</p> : null}

        <button className="cta auth-cta" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/auth/register">Crear cuenta</Link>
        <Link href="/auth/forgot-password">Recuperar contraseña</Link>
      </div>
    </>
  );
}
