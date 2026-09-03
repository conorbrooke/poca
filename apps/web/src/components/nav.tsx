"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/spending", label: "Spending", icon: SpendingIcon },
  { href: "/income", label: "Income", icon: IncomeIcon },
  { href: "/spending/tags", label: "Tags", icon: TagsIcon },
  { href: "/sync", label: "Banks", icon: BanksIcon },
  { href: "/guide", label: "Guide", icon: GuideIcon },
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

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="2" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="2" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="2" />
    </svg>
  );
}

function SpendingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d="M12 4v12.5" />
      <path d="M7.5 12.5 12 17l4.5-4.5" />
      <path d="M5 19.5h14" />
    </svg>
  );
}

function IncomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d="M12 20V7.5" />
      <path d="M7.5 11.5 12 7l4.5 4.5" />
      <path d="M5 4.5h14" />
    </svg>
  );
}

function TagsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d="M20 13.2 12.8 20.4a2 2 0 0 1-2.8 0L4 14.4V4h10.4l5.6 5.6a2 2 0 0 1 0 3.6Z" />
      <circle cx="9" cy="9" r="1.2" />
    </svg>
  );
}

function BanksIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d="M4 10h16" />
      <path d="M6 10v7" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
      <path d="M18 10v7" />
      <path d="M3 17h18" />
      <path d="M12 4 3.5 9h17L12 4Z" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" />
      <path d="M5 5.5v16" />
      <path d="M9 8h6.5" />
      <path d="M9 12h6.5" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link href="/" className="app-brand">
            <BrandLogo size={36} />
            <span className="app-brand-copy">
              <span className="app-brand-name">Póca</span>
              <span className="app-brand-tag">Know where it goes</span>
            </span>
          </Link>
          <nav className="app-nav-links" aria-label="Main">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link${active ? " active" : ""}`}
                >
                  <Icon />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <nav className="app-tabbar" aria-label="Primary">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`tabbar-link${active ? " active" : ""}`}
            >
              <Icon />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
