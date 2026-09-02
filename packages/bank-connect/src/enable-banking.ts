import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createEnableBankingJwt } from "./jwt.js";
import type {
  BankConnectProvider,
  BankLinkResult,
  EnableBankingConfig,
  ExternalAccount,
  ExternalBalance,
  ExternalTransaction,
  Institution,
  RequisitionStatus,
} from "./types.js";
import {
  encodeInstitutionId,
  parseInstitutionId,
} from "./types.js";
import { buildFallbackExternalId } from "./transaction-id.js";

const DEFAULT_API_ORIGIN = "https://api.enablebanking.com";

export type EnableBankingErrorBody = {
  code?: number;
  message?: string;
  error?: string;
  detail?: unknown;
};

export class EnableBankingApiError extends Error {
  readonly status: number;
  readonly body: EnableBankingErrorBody;

  constructor(status: number, body: EnableBankingErrorBody) {
    super(body.message ?? `Enable Banking API error ${status}`);
    this.name = "EnableBankingApiError";
    this.status = status;
    this.body = body;
  }
}

// Account Servicing Payment Service Provider (ASPSP)
interface EnableBankingAspsp {
  name: string;
  country: string;
  logo?: string;
}

interface EnableBankingTransaction {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount?: { currency?: string; amount?: string };
  remittance_information?: string[];
  creditor?: { name?: string };
  debtor?: { name?: string };
  credit_debit_indicator?: "CRDT" | "DBIT";
  booking_date?: string;
  value_date?: string;
}

export class EnableBankingProvider implements BankConnectProvider {
  private readonly applicationId: string;
  private readonly privateKey: string;
  private readonly apiOrigin: string;

  constructor(config: EnableBankingConfig) {
    this.applicationId = config.applicationId;
    this.privateKey = config.privateKey;
    this.apiOrigin = config.apiOrigin ?? DEFAULT_API_ORIGIN;
  }

  static fromEnv(config: {
    applicationId: string;
    privateKeyPath?: string;
    privateKey?: string;
    apiOrigin?: string;
  }): EnableBankingProvider {
    let privateKey = config.privateKey;
    if (!privateKey && config.privateKeyPath) {
      privateKey = readFileSync(config.privateKeyPath, "utf8");
    }
    if (!privateKey) {
      throw new Error(
        "Enable Banking private key is required (path or inline PEM)",
      );
    }

    return new EnableBankingProvider({
      applicationId: config.applicationId,
      privateKey,
      apiOrigin: config.apiOrigin,
    });
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const jwt = await createEnableBankingJwt(
      this.applicationId,
      this.privateKey,
    );

    const response = await fetch(`${this.apiOrigin}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      let parsed: EnableBankingErrorBody = {};
      try {
        parsed = JSON.parse(body) as EnableBankingErrorBody;
      } catch {
        parsed = { message: body };
      }
      throw new EnableBankingApiError(response.status, parsed);
    }

    return response.json() as Promise<T>;
  }

  async listInstitutions(countryCode: string): Promise<Institution[]> {
    const data = await this.request<{ aspsps: EnableBankingAspsp[] }>(
      `/aspsps?country=${encodeURIComponent(countryCode)}`,
    );

    return data.aspsps.map((aspsp) => ({
      id: encodeInstitutionId(aspsp.country, aspsp.name),
      name: aspsp.name,
      logo: aspsp.logo,
      countries: [aspsp.country],
    }));
  }

  async createBankLink(
    institutionId: string,
    redirectUrl: string,
    referenceId?: string,
  ): Promise<BankLinkResult> {
    const { country, name } = parseInstitutionId(institutionId);
    const state = referenceId ?? randomUUID();
    const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const data = await this.request<{ url: string }>("/auth", {
      method: "POST",
      body: JSON.stringify({
        access: {
          valid_until: validUntil.toISOString(),
        },
        aspsp: { name, country },
        state,
        redirect_url: redirectUrl,
        psu_type: "personal",
      }),
    });

    return {
      requisitionId: state,
      link: data.url,
      referenceId: state,
    };
  }

  async completeBankLink(code: string): Promise<RequisitionStatus> {
    const data = await this.request<{
      session_id: string;
      accounts: Array<{ uid: string }>;
      aspsp: { name: string; country: string };
    }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ code }),
    });

    return {
      id: data.session_id,
      status: "AUTHORIZED",
      institutionId: encodeInstitutionId(
        data.aspsp.country,
        data.aspsp.name,
      ),
      accountIds: data.accounts.map((account) => account.uid),
    };
  }

  async getRequisition(sessionId: string): Promise<RequisitionStatus> {
    const data = await this.request<{
      status: string;
      accounts: string[];
      aspsp: { name: string; country: string };
    }>(`/sessions/${sessionId}`);

    return {
      id: sessionId,
      status: data.status,
      institutionId: encodeInstitutionId(
        data.aspsp.country,
        data.aspsp.name,
      ),
      accountIds: data.accounts ?? [],
    };
  }

  async getAccount(accountId: string): Promise<ExternalAccount> {
    const data = await this.request<{
      account_id?: { iban?: string };
      name?: string;
      currency?: string;
    }>(`/accounts/${accountId}/details`);

    return {
      id: accountId,
      iban: data.account_id?.iban,
      name: data.name,
      currency: data.currency ?? "EUR",
    };
  }

  async getBalances(accountId: string): Promise<ExternalBalance[]> {
    const data = await this.request<{
      balances?: Array<{
        balance_amount?: { currency?: string; amount?: string };
      }>;
    }>(`/accounts/${accountId}/balances`);

    return (data.balances ?? []).map((balance) => ({
      amount: parseFloat(balance.balance_amount?.amount ?? "0"),
      currency: balance.balance_amount?.currency ?? "EUR",
    }));
  }

  async getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<ExternalTransaction[]> {
    const baseParams = new URLSearchParams();
    if (dateFrom) {
      baseParams.set("date_from", dateFrom.slice(0, 10));
    }
    if (dateTo) {
      baseParams.set("date_to", dateTo.slice(0, 10));
    }

    const allTransactions: ExternalTransaction[] = [];
    let continuationKey: string | undefined;

    do {
      const params = new URLSearchParams(baseParams);
      if (continuationKey) {
        params.set("continuation_key", continuationKey);
      }

      const data = await this.request<{
        transactions?: EnableBankingTransaction[];
        continuation_key?: string | null;
      }>(`/accounts/${accountId}/transactions?${params.toString()}`);

      allTransactions.push(
        ...(data.transactions ?? []).map((tx) => this.mapTransaction(tx)),
      );
      continuationKey = data.continuation_key ?? undefined;
    } while (continuationKey);

    return allTransactions;
  }

  private mapTransaction(tx: EnableBankingTransaction): ExternalTransaction {
    const rawAmount = parseFloat(tx.transaction_amount?.amount ?? "0");
    const description =
      tx.remittance_information?.join(" ") ??
      tx.creditor?.name ??
      tx.debtor?.name ??
      "Transaction";
    const merchant = tx.creditor?.name ?? tx.debtor?.name;
    const bookingDate =
      tx.booking_date ?? tx.value_date ?? new Date().toISOString().slice(0, 10);
    const stableDate =
      tx.value_date ?? tx.booking_date ?? bookingDate;
    const signedAmount =
      tx.credit_debit_indicator === "DBIT" ? -Math.abs(rawAmount) : rawAmount;

    return {
      externalId:
        tx.entry_reference ??
        tx.transaction_id ??
        buildFallbackExternalId(signedAmount, description, stableDate),
      amount: signedAmount,
      currency: tx.transaction_amount?.currency ?? "EUR",
      description,
      merchant,
      bookedAt: new Date(bookingDate),
    };
  }
}

export function createEnableBankingProvider(
  config: EnableBankingConfig,
): BankConnectProvider {
  return new EnableBankingProvider(config);
}
