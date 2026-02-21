"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { hasAuthToken } from "../../lib/api";
import { flushSyncQueue } from "../../lib/sync";

import { DesktopSidebar, MobileTabNav } from "./nav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth");
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (isAuthRoute) {
      setCheckedAuth(true);
      setAuthenticated(true);
      return;
    }

    setCheckedAuth(false);
    setAuthenticated(hasAuthToken());
    setCheckedAuth(true);
  }, [isAuthRoute, pathname]);

  useEffect(() => {
    if (!authenticated || isAuthRoute) return;
    flushSyncQueue();
  }, [authenticated, isAuthRoute]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!checkedAuth) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <p className="page-subtitle">Cargando</p>
          <h1 className="auth-title">Comprobando sesion</h1>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <p className="page-subtitle">Acceso requerido</p>
          <h1 className="auth-title">Inicia sesion para usar Gymnasia</h1>
          <p className="auth-description">
            Necesitas cuenta para sincronizar datos entre web y movil.
          </p>
          <div className="auth-links">
            <Link href="/auth/login" className="cta cta-link">
              Ir a login
            </Link>
            <Link href="/auth/register" className="action-pill">
              Crear cuenta
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="app-shell">
        <DesktopSidebar />
        <main className="page">{children}</main>
      </div>
      <MobileTabNav />
    </>
  );
}
