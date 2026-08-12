import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  completeBankLinkSchema,
  connectionIdParamSchema,
  createBankLinkSchema,
  dashboardQuerySchema,
  listInstitutionsQuerySchema,
  syncTransactionsSchema,
  transactionsQuerySchema,
} from "@poca/shared";
import { parseOrThrow } from "../common/parse-or-throw";
import { BankService } from "./bank.service";

@Controller("bank")
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get("institutions")
  listInstitutions(@Query() query: unknown) {
    const { country } = parseOrThrow(
      listInstitutionsQuerySchema,
      query,
      "List institutions query",
    );
    return this.bankService.listInstitutions(country);
  }

  @Post("link")
  createLink(@Body() body: unknown) {
    const input = parseOrThrow(
      createBankLinkSchema,
      body,
      "Create bank link body",
    );
    return this.bankService.createLink(input);
  }

  @Post("callback")
  completeLink(@Body() body: unknown) {
    const input = parseOrThrow(
      completeBankLinkSchema,
      body,
      "Complete bank link body",
    );
    return this.bankService.completeLink(input);
  }

  @Get("connections")
  listConnections() {
    return this.bankService.listConnections();
  }

  @Get("connections/:id")
  getConnection(@Param() params: unknown) {
    const { id } = parseOrThrow(
      connectionIdParamSchema,
      params,
      "Connection id param",
    );
    return this.bankService.getConnection(id);
  }

  @Post("sync")
  syncTransactions(@Body() body: unknown) {
    const input = parseOrThrow(
      syncTransactionsSchema,
      body,
      "Sync transactions body",
    );
    return this.bankService.syncTransactions(input);
  }

  @Get("dashboard")
  getDashboard(@Query() query: unknown) {
    const { bankConnectionId } = parseOrThrow(
      dashboardQuerySchema,
      query,
      "Dashboard query",
    );
    return this.bankService.getDashboard(bankConnectionId);
  }

  @Get("transactions")
  listTransactions(@Query() query: unknown) {
    const input = parseOrThrow(
      transactionsQuerySchema,
      query,
      "Transactions query",
    );
    return this.bankService.listTransactions(input);
  }
}
