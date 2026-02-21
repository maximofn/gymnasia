"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError } from "../../../lib/api";
import { verifyEmail } from "../../../lib/auth";

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await verifyEmail();
      setMessage(response.message || "Email verificado.");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("No se pudo verificar el email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="page-subtitle">Verificacion</p>
      <h1 className="auth-title">Verificar email</h1>
      <p className="auth-description">Necesitas sesion iniciada para ejecutar la verificacion en v1.</p>

      <button className="cta auth-cta" onClick={onVerify} disabled={loading}>
        {loading ? "Verificando..." : "Verificar ahora"}
      </button>

      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <div className="auth-links">
        <Link href="/auth/login">Ir a login</Link>
      </div>
    </>
  );
}
