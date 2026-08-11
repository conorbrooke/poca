export interface GoCardlessConfig {
  secretId: string;
  secretKey: string;
}

export interface EnableBankingConfig {
  applicationId: string;
  privateKey: string;
  apiOrigin?: string;
}

export interface Institution {
  id: string;
  name: string;
  logo?: string;
  countries: string[];
}

export interface BankLinkResult {
  requisitionId: string;
  link: string;
  referenceId: string;
}

export interface RequisitionStatus {
  id: string;
  status: string;
  institutionId: string;
  accountIds: string[];
}

export interface ExternalAccount {
  id: string;
  iban?: string;
  name?: string;
  currency?: string;
}

export interface ExternalBalance {
  amount: number;
  currency: string;
}

export interface ExternalTransaction {
  externalId: string;
  amount: number;
  currency: string;
  description: string;
  merchant?: string;
  bookedAt: Date;
}

export interface BankConnectProvider {
  listInstitutions(countryCode?: string): Promise<Institution[]>;
  createBankLink(
    institutionId: string,
    redirectUrl: string,
    referenceId?: string,
  ): Promise<BankLinkResult>;
  getRequisition(requisitionId: string): Promise<RequisitionStatus>;
  getAccount(accountId: string): Promise<ExternalAccount>;
  getBalances(accountId: string): Promise<ExternalBalance[]>;
  getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<ExternalTransaction[]>;
  completeBankLink?(code: string): Promise<RequisitionStatus>;
}

/** Encode ASPSP as institution id: "IE|Revolut" */
export function encodeInstitutionId(country: string, name: string): string {
  return `${country}|${name}`;
}

export function parseInstitutionId(id: string): { country: string; name: string } {
  const separator = id.indexOf("|");
  if (separator === -1) {
    throw new Error(`Invalid institution id: ${id}`);
  }
  return {
    country: id.slice(0, separator),
    name: id.slice(separator + 1),
  };
}
