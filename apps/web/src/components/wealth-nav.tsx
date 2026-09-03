"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/wealth", label: "Overview" },
  { href: "/wealth/budget", label: "Budget" },
  { href: "/wealth/habits", label: "Leaks" },
  { href: "/wealth/bills", label: "Bills" },
  { href: "/wealth/goals", label: "Goals" },
  { href: "/wealth/net-worth", label: "Net worth" },
  { href: "/wealth/pension", label: "Pension" },
  { href: "/wealth/investments", label: "Investments" },
];

const PERIOD_KEYS = ["year", "month", "from", "to", "range"] as const;

export function wealthPeriodSuffix(searchParams: {
  get(name: string): string | null;
}): string {
  const params = new URLSearchParams();
  for (const key of PERIOD_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export function WealthNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const suffix = wealthPeriodSuffix(searchParams);

  return (
    <div className="spending-subnav wealth-subnav">
      {links.map((link) => {
        const active =
          link.href === "/wealth"
            ? pathname === "/wealth"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={`${link.href}${suffix}`}
            className={`tag-chip${active ? " active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
