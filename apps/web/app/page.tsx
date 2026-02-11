import Link from "next/link";

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
  },
  {
    href: "/chat",
    title: "Chats IA",
    description: "Conversacion libre por seccion + envio de audio."
  }
];

export default function HomePage() {
  return (
    <section className="grid two">
      {cards.map((card) => (
        <Link href={card.href} key={card.href} className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h2>{card.title}</h2>
          <p>{card.description}</p>
          <span className="pill">Abrir modulo</span>
        </Link>
      ))}
    </section>
  );
}
