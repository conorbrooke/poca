"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applySpendingPeriod,
  currentCalendarMonth,
  parseSpendingPeriodFromSearch,
  spendingPeriodQueryString,
  type ClientSpendingPeriod,
} from "@poca/shared";

const STORAGE_KEY = "poca-spending-period";

function readStoredPeriod(): ClientSpendingPeriod | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientSpendingPeriod;
    if (parsed.kind === "all") return parsed;
    if (
      parsed.kind === "month" &&
      Number.isInteger(parsed.year) &&
      Number.isInteger(parsed.month)
    ) {
      return parsed;
    }
    if (
      parsed.kind === "custom" &&
      typeof parsed.from === "string" &&
      typeof parsed.to === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredPeriod(period: ClientSpendingPeriod) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(period));
}

export function useSpendingPeriod() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlPeriod = parseSpendingPeriodFromSearch(searchParams);
  const [period, setPeriodState] = useState<ClientSpendingPeriod>(
    () => urlPeriod ?? currentCalendarMonth(),
  );

  useEffect(() => {
    const fromUrl = parseSpendingPeriodFromSearch(searchParams);
    if (fromUrl) {
      setPeriodState(fromUrl);
      writeStoredPeriod(fromUrl);
      return;
    }
    const stored = readStoredPeriod();
    const next = stored ?? currentCalendarMonth();
    setPeriodState(next);
    const params = applySpendingPeriod(
      new URLSearchParams(searchParams.toString()),
      next,
    );
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const setPeriod = useCallback(
    (next: ClientSpendingPeriod) => {
      writeStoredPeriod(next);
      setPeriodState(next);
      const params = applySpendingPeriod(
        new URLSearchParams(searchParams.toString()),
        next,
      );
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return {
    period,
    setPeriod,
    queryString: spendingPeriodQueryString(period),
  };
}

export function periodSearchParams(period: ClientSpendingPeriod): URLSearchParams {
  return applySpendingPeriod(new URLSearchParams(), period);
}
