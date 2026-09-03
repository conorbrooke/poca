"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/wealth", label: "Overview" },
  { href: "/wealth/budget", label: "Budget" },
  { href: "/wealth/habits", label: "Habits" },
  { href: "/wealth/bills", label: "Bills" },
  { href: "/wealth/goals", label: "Goals" },
  { href: "/wealth/net-worth", label: "Net worth" },
  { href: "/wealth/pension", label: "Pension" },
  { href: "/wealth/investments", label: "Investments" },
];

export function WealthNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const suffix =
    year && month ? `?year=${year}&month=${month}` : "";

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

export function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });

  function shift(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    onChange(next.getFullYear(), next.getMonth() + 1);
  }

  return (
    <div className="range-tabs" style={{ marginBottom: "1rem" }}>
      <button type="button" className="range-tab" onClick={() => shift(-1)}>
        Previous
      </button>
      <span className="range-tab active">{label}</span>
      <button type="button" className="range-tab" onClick={() => shift(1)}>
        Next
      </button>
    </div>
  );
}
