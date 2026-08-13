"use client";

import { useCallback, useEffect, useState } from "react";
import { SPENDING_RANGES, type SpendingRangeId } from "@poca/shared";

const STORAGE_KEY = "poca-spending-range";
const DEFAULT_RANGE: SpendingRangeId = "month";

const VALID_RANGE_IDS = new Set(SPENDING_RANGES.map((option) => option.id));

function isSpendingRange(value: string | null | undefined): value is SpendingRangeId {
  return Boolean(value && VALID_RANGE_IDS.has(value as SpendingRangeId));
}

export function getStoredSpendingRange(): SpendingRangeId {
  if (typeof window === "undefined") return DEFAULT_RANGE;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isSpendingRange(stored) ? stored : DEFAULT_RANGE;
}

export function setStoredSpendingRange(range: SpendingRangeId) {
  localStorage.setItem(STORAGE_KEY, range);
}

export function useSpendingRange(urlRange?: string | null) {
  const [range, setRangeState] = useState<SpendingRangeId>(DEFAULT_RANGE);

  useEffect(() => {
    const next = isSpendingRange(urlRange) ? urlRange : getStoredSpendingRange();
    setRangeState(next);
    if (isSpendingRange(urlRange)) {
      setStoredSpendingRange(urlRange);
    }
  }, [urlRange]);

  const setRange = useCallback((next: SpendingRangeId) => {
    setRangeState(next);
    setStoredSpendingRange(next);
  }, []);

  return [range, setRange] as const;
}
