export function formatMoney(
  amount: number,
  currency = "EUR",
  options?: { signed?: boolean },
): string {
  const formatted = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (options?.signed && amount !== 0) {
    return amount > 0 ? `+${formatted}` : `−${formatted}`;
  }

  return formatted;
}

export function formatMoneyList(
  balances: Array<{ amount: number; currency: string }>,
): string {
  if (balances.length === 0) {
    return formatMoney(0);
  }
  return balances
    .map((balance) => formatMoney(balance.amount, balance.currency))
    .join(" · ");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return "Never synced";

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Synced just now";
  if (diffMins < 60) return `Synced ${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Synced ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Synced ${diffDays}d ago`;
}
