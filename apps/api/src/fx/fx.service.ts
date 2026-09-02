import { Injectable, Logger } from "@nestjs/common";
import {
  convertToEur,
  HOME_CURRENCY,
  isSameLocalDay,
  normalizeRateMap,
} from "./convert";

const RATE_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json",
  "https://latest.currency-api.pages.dev/v1/currencies/eur.json",
];

type RateCache = {
  fetchedOn: Date;
  rates: Record<string, number>;
};

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  readonly convertedTotalsSince = new Date();
  private cache: RateCache | null = null;

  async getRates(): Promise<Record<string, number>> {
    const now = new Date();
    if (this.cache && isSameLocalDay(this.cache.fetchedOn, now)) {
      return this.cache.rates;
    }

    try {
      const rates = await this.fetchRates();
      this.cache = { fetchedOn: now, rates };
      return rates;
    } catch (error) {
      this.logger.warn(
        `Could not fetch today's FX rates: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      if (this.cache) return this.cache.rates;
      return { [HOME_CURRENCY]: 1 };
    }
  }

  toEur(
    amount: number,
    currency: string,
    rates: Record<string, number>,
  ): number {
    return convertToEur(amount, currency, rates);
  }

  isConvertedCacheFresh(computedAt: Date): boolean {
    return (
      computedAt >= this.convertedTotalsSince &&
      isSameLocalDay(computedAt, new Date())
    );
  }

  private async fetchRates(): Promise<Record<string, number>> {
    let lastError: unknown;

    for (const url of RATE_URLS) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const data = (await response.json()) as {
          eur?: Record<string, unknown>;
        };
        if (!data.eur || typeof data.eur !== "object") {
          throw new Error("FX payload missing eur rates");
        }
        return normalizeRateMap(data.eur);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("FX rates unavailable");
  }
}
