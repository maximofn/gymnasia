"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const cards = [
  {
    href: "/training",
    title: "Entrenamiento",
    description: "Plantillas, sesiones, PRs, clonados y reordenado en vivo."
  },
  {
    href: "/diet",
    title: "Dieta",
    description: "Dieta diaria, comidas, recetas escalables y macros detallados."
  },
  {
    href: "/measures",
    title: "Medidas",
    description: "Peso, contornos y fotos para seguimiento historico."
  }
] as const;

export default function HomePage() {
  const [activeHref, setActiveHref] = useState<(typeof cards)[number]["href"]>(cards[0].href);
  const activeCard = useMemo(() => cards.find((card) => card.href === activeHref) ?? cards[0], [activeHref]);

  return (
    <section className="panel" style={{ display: "grid", gap: "1rem" }}>
      <div className="tabs" role="tablist" aria-label="Secciones de Gymnasia">
        {cards.map((card) => {
          const isActive = card.href === activeCard.href;
          return (
            <button
              key={card.href}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveHref(card.href)}
            >
              {card.title}
            </button>
          );
        })}
      </div>

      <article role="tabpanel" className="panel" style={{ display: "grid", gap: ".7rem" }}>
        <h2>{activeCard.title}</h2>
        <p>{activeCard.description}</p>
        <div>
          <Link href={activeCard.href} className="pill">
            Abrir modulo
          </Link>
        </div>
      </article>
    </section>
  );
}
