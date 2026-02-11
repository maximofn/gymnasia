import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";

import { Navigation } from "@/components/nav";

import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces"
});

export const metadata: Metadata = {
  title: "Gymnasia",
  description: "App de gimnasio con entrenamiento, dieta, medidas y agente IA"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${sora.variable} ${fraunces.variable}`}>
        <main>
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "grid", gap: ".6rem" }}>
              <h1>Gymnasia</h1>
              <p>Entrena, come mejor y analiza todo con agentes en contexto por seccion.</p>
              <Navigation />
            </div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
