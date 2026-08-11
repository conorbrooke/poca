declare module "nordigen-node" {
  interface NordigenClientConfig {
    secretId: string;
    secretKey: string;
  }

  interface InitSessionParams {
    redirectUrl: string;
    institutionId: string;
    referenceId: string;
  }

  interface AccountHandle {
    getMetadata(): Promise<unknown>;
    getBalances(): Promise<unknown>;
    getDetails(): Promise<unknown>;
    getTransactions(params?: {
      dateFrom?: string;
      dateTo?: string;
    }): Promise<unknown>;
  }

  export default class NordigenClient {
    constructor(config: NordigenClientConfig);
    generateToken(): Promise<void>;
    institution: {
      getInstitutions(params: { country: string }): Promise<unknown[]>;
    };
    initSession(params: InitSessionParams): Promise<{ id: string; link: string }>;
    requisition: {
      getRequisitionById(id: string): Promise<unknown>;
    };
    account(accountId: string): AccountHandle;
  }
}
