import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/training", label: "Entrenamiento" },
  { href: "/diet", label: "Dieta" },
  { href: "/measures", label: "Medidas" },
  { href: "/chat", label: "Chats" }
];

export function Navigation() {
  return (
    <nav className="nav" aria-label="Navegacion principal">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
