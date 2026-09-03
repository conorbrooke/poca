export type SpendingRangeId =
  | "week"
  | "month"
  | "quarter"
  | "6months"
  | "year"
  | "all";

export type SpendingPeriodKind = "month" | "custom" | "all" | "week";

export type SpendingPeriodInput = {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  range?: SpendingRangeId;
};

export type ClientSpendingPeriod =
  | { kind: "month"; year: number; month: number }
  | { kind: "custom"; from: string; to: string }
  | { kind: "all" };

export type ResolvedSpendingPeriod = {
  kind: SpendingPeriodKind;
  periodStart: Date;
  periodEnd: Date;
  label: string;
  cacheKey: string;
  year?: number;
  month?: number;
  from?: string;
  to?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function currentCalendarMonth(
  now = new Date(),
): Extract<ClientSpendingPeriod, { kind: "month" }> {
  return { kind: "month", year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(iso: string, endOfDay = false): Date {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

export function monthStart(year: number, month: number): Date {
  const date = new Date(year, month - 1, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function monthEnd(year: number, month: number): Date {
  const date = new Date(year, month, 0);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function shiftCalendarMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });
}

export function spendingPeriodLabel(period: ClientSpendingPeriod): string {
  if (period.kind === "all") return "All time";
  if (period.kind === "custom") {
    return `${formatDayLabel(period.from)} – ${formatDayLabel(period.to)}`;
  }
  return formatMonthLabel(period.year, period.month);
}

export function applySpendingPeriod(
  params: URLSearchParams,
  period: ClientSpendingPeriod,
): URLSearchParams {
  params.delete("range");
  params.delete("year");
  params.delete("month");
  params.delete("from");
  params.delete("to");
  if (period.kind === "all") {
    params.set("range", "all");
  } else if (period.kind === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  } else {
    params.set("year", String(period.year));
    params.set("month", String(period.month));
  }
  return params;
}

export function spendingPeriodQueryString(period: ClientSpendingPeriod): string {
  return applySpendingPeriod(new URLSearchParams(), period).toString();
}

export function parseSpendingPeriodFromSearch(
  search: { get(name: string): string | null },
): ClientSpendingPeriod | null {
  const from = search.get("from");
  const to = search.get("to");
  if (isIsoDate(from) && isIsoDate(to)) {
    return from <= to
      ? { kind: "custom", from, to }
      : { kind: "custom", from: to, to: from };
  }

  if (search.get("range") === "all") {
    return { kind: "all" };
  }

  const year = Number(search.get("year"));
  const month = Number(search.get("month"));
  if (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  ) {
    return { kind: "month", year, month };
  }

  return null;
}

export function resolveSpendingPeriod(
  input: SpendingPeriodInput,
  now = new Date(),
): ResolvedSpendingPeriod {
  if (isIsoDate(input.from) && isIsoDate(input.to)) {
    const from = input.from <= input.to ? input.from : input.to;
    const to = input.from <= input.to ? input.to : input.from;
    return {
      kind: "custom",
      periodStart: parseDateOnly(from),
      periodEnd: parseDateOnly(to, true),
      label: `${formatDayLabel(from)} – ${formatDayLabel(to)}`,
      cacheKey: `custom:${from}:${to}`,
      from,
      to,
    };
  }

  if (input.year && input.month) {
    return calendarMonthPeriod(input.year, input.month);
  }

  if (input.range === "all") {
    const periodEnd = endOfToday(now);
    return {
      kind: "all",
      periodStart: new Date(2000, 0, 1, 0, 0, 0, 0),
      periodEnd,
      label: "All time",
      cacheKey: "all",
    };
  }

  if (input.range === "week") {
    const periodEnd = endOfToday(now);
    const periodStart = startOfWeek(now);
    return {
      kind: "week",
      periodStart,
      periodEnd,
      label: "This week",
      cacheKey: "week",
    };
  }

  const current = currentCalendarMonth(now);

  if (input.range === "quarter") {
    const start = shiftCalendarMonth(current.year, current.month, -2);
    return spanMonths(start.year, start.month, current.year, current.month);
  }

  if (input.range === "6months") {
    const start = shiftCalendarMonth(current.year, current.month, -5);
    return spanMonths(start.year, start.month, current.year, current.month);
  }

  if (input.range === "year") {
    return spanMonths(current.year, 1, current.year, 12);
  }

  return calendarMonthPeriod(current.year, current.month);
}

function calendarMonthPeriod(year: number, month: number): ResolvedSpendingPeriod {
  return {
    kind: "month",
    periodStart: monthStart(year, month),
    periodEnd: monthEnd(year, month),
    label: formatMonthLabel(year, month),
    cacheKey: "month",
    year,
    month,
  };
}

function spanMonths(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): ResolvedSpendingPeriod {
  const from = formatDateOnly(monthStart(fromYear, fromMonth));
  const to = formatDateOnly(monthEnd(toYear, toMonth));
  return {
    kind: "custom",
    periodStart: monthStart(fromYear, fromMonth),
    periodEnd: monthEnd(toYear, toMonth),
    label: `${formatMonthLabel(fromYear, fromMonth)} – ${formatMonthLabel(toYear, toMonth)}`,
    cacheKey: `custom:${from}:${to}`,
    from,
    to,
  };
}

function startOfWeek(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

function endOfToday(now: Date): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDayLabel(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isIsoDate(value: string | undefined | null): value is string {
  return Boolean(value && ISO_DATE.test(value));
}

export function budgetMonthFromPeriod(period: ResolvedSpendingPeriod): {
  year: number;
  month: number;
} {
  if (period.year && period.month) {
    return { year: period.year, month: period.month };
  }
  return {
    year: period.periodEnd.getFullYear(),
    month: period.periodEnd.getMonth() + 1,
  };
}

export function previousPeriodWindow(period: ResolvedSpendingPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const length = Math.max(period.periodEnd.getTime() - period.periodStart.getTime(), 0);
  const periodEnd = new Date(period.periodStart.getTime() - 1);
  const periodStart = new Date(periodEnd.getTime() - length);
  return { periodStart, periodEnd };
}

export function spendingPeriodHrefQuery(period: ResolvedSpendingPeriod): string {
  if (period.kind === "all") {
    return spendingPeriodQueryString({ kind: "all" });
  }
  if (period.from && period.to) {
    return spendingPeriodQueryString({
      kind: "custom",
      from: period.from,
      to: period.to,
    });
  }
  if (period.year && period.month) {
    return spendingPeriodQueryString({
      kind: "month",
      year: period.year,
      month: period.month,
    });
  }
  return spendingPeriodQueryString({
    kind: "custom",
    from: formatDateOnly(period.periodStart),
    to: formatDateOnly(period.periodEnd),
  });
}
