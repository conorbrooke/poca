"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/spending", label: "Spending" },
  { href: "/spending/tags", label: "Tags" },
  { href: "/sync", label: "Connect bank" },
];

function isActive(pathname: string, href: string) {
  if (href === "/spending") {
    return (
      pathname === "/spending" ||
      (pathname.startsWith("/spending/") &&
        !pathname.startsWith("/spending/tags"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
              className={`nav-link${isActive(pathname, link.href) ? " active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
