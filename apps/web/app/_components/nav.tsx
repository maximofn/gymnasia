"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Inicio", short: "Home" },
  { href: "/training", label: "Entrenamiento", short: "Train" },
  { href: "/diet", label: "Dieta", short: "Dieta" },
  { href: "/measurements", label: "Medidas", short: "Stats" },
  { href: "/chat", label: "Chat IA", short: "IA" },
  { href: "/settings", label: "Ajustes", short: "Cfg" },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot">G</span>
        <span>GYMNASIA</span>
      </div>

      <nav className="menu" aria-label="Main">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "menu-item active" : "menu-item"}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-dot">A</div>
        <div>
          <p className="sidebar-user-name">Alex Rivera</p>
          <p className="sidebar-user-plan">Plan Premium</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileTabNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-tab-nav" aria-label="Bottom tabs">
      {navItems.map((item) => {
        const active = isItemActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "mobile-tab-item active" : "mobile-tab-item"}>
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
