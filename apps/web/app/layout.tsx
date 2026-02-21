import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/app-shell";

export const metadata: Metadata = {
  title: "Gymnasia",
  description: "Gym app v1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
