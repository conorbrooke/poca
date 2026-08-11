"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sync", label: "Connect bank" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">P</span>
          <span>Póca</span>
        </Link>
        <nav className="app-nav-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${pathname.startsWith(link.href) ? " active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
