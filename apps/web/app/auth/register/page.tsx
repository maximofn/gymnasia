"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ApiError } from "../../../lib/api";
import { register } from "../../../lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxBirthDate = (() => {
    const now = new Date();
    now.setFullYear(now.getFullYear() - 18);
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  function isAdult(value: string): boolean {
    if (!value) return false;
    const birth = new Date(value);
    if (Number.isNaN(birth.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDelta = now.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age >= 18;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!isAdult(birthDate)) {
      setError("Debes tener 18 años o más para crear cuenta.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, birthDate);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo crear la cuenta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="page-subtitle">Alta de usuario</p>
      <h1 className="auth-title">Crear cuenta</h1>
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
          Fecha de nacimiento
          <input
            className="auth-input"
            type="date"
            required
            max={maxBirthDate}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
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
            placeholder="Minimo 8 caracteres"
          />
        </label>

        <label className="auth-label">
          Confirmar password
          <input
            className="auth-input"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repite password"
          />
        </label>

        {error ? <p className="status-message error">{error}</p> : null}

        <button className="cta auth-cta" disabled={submitting}>
          {submitting ? "Creando..." : "Crear cuenta"}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/auth/login">Ya tengo cuenta</Link>
      </div>
    </>
  );
}
