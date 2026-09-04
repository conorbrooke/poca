import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  assignGoalTransactionSchema,
  assignWealthFromTransactionSchema,
  assignWealthTransactionSchema,
  copyBudgetSchema,
  debtOrderSchema,
  spendingPeriodQuerySchema,
  upsertBillPayeeSchema,
  upsertBillSchema,
  upsertBudgetSchema,
  upsertGoalSchema,
  upsertHoldingSchema,
  upsertWealthItemSchema,
  upsertWealthValuationSchema,
} from "@poca/shared";
import { parseOrThrow } from "../common/parse-or-throw";
import { WealthService } from "./wealth.service";

@Controller("wealth")
export class WealthController {
  constructor(private readonly wealth: WealthService) {}

  @Get("overview")
  getOverview(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.getOverview(input);
  }

  @Get("series")
  getSeries(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.getSeries(input);
  }

  @Get("budget")
  getBudget(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.getBudget(input);
  }

  @Put("budget")
  upsertBudget(@Body() body: unknown) {
    const input = parseOrThrow(upsertBudgetSchema, body, "Budget body");
    return this.wealth.upsertBudget(input);
  }

  @Post("budget/copy")
  copyBudget(@Body() body: unknown) {
    const input = parseOrThrow(copyBudgetSchema, body, "Copy budget body");
    return this.wealth.copyBudget(input);
  }

  @Get("habits")
  getHabits(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.getHabits(input);
  }

  @Get("bills")
  listBills(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.listBills(input);
  }

  @Get("bills/suggestions")
  suggestBills() {
    return this.wealth.suggestBills();
  }

  @Post("bills")
  createBill(@Body() body: unknown) {
    const input = parseOrThrow(upsertBillSchema, body, "Bill body");
    return this.wealth.createBill(input);
  }

  @Patch("bills/:id")
  updateBill(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(upsertBillSchema, body, "Bill body");
    return this.wealth.updateBill(id, input);
  }

  @Delete("bills/:id")
  deleteBill(@Param("id") id: string) {
    return this.wealth.deleteBill(id);
  }

  @Post("bills/payees")
  upsertBillPayee(@Body() body: unknown) {
    const input = parseOrThrow(upsertBillPayeeSchema, body, "Bill payee body");
    return this.wealth.upsertBillPayee(input);
  }

  @Get("goals")
  listGoals() {
    return this.wealth.listGoals();
  }

  @Post("goals")
  createGoal(@Body() body: unknown) {
    const input = parseOrThrow(upsertGoalSchema, body, "Goal body");
    return this.wealth.createGoal(input);
  }

  @Patch("goals/:id")
  updateGoal(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(upsertGoalSchema, body, "Goal body");
    return this.wealth.updateGoal(id, input);
  }

  @Get("goals/:id/candidates")
  listGoalCandidates(@Param("id") id: string) {
    return this.wealth.listGoalCandidates(id);
  }

  @Post("goals/:id/funding")
  assignGoalTransaction(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(
      assignGoalTransactionSchema,
      body,
      "Assign goal transaction body",
    );
    return this.wealth.assignGoalTransaction(id, input.transactionId);
  }

  @Delete("goals/:id/funding/:transactionId")
  unassignGoalTransaction(
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
  ) {
    return this.wealth.unassignGoalTransaction(id, transactionId);
  }

  @Delete("goals/:id")
  deleteGoal(@Param("id") id: string) {
    return this.wealth.deleteGoal(id);
  }

  @Get("accounts")
  listAccounts() {
    return this.wealth.listAccounts();
  }

  @Get("net-worth")
  getNetWorth() {
    return this.wealth.getNetWorth();
  }

  @Post("net-worth/snapshot")
  snapshotNetWorth() {
    return this.wealth.snapshotNetWorth();
  }

  @Get("net-worth/snapshots")
  listSnapshots() {
    return this.wealth.listSnapshots();
  }

  @Post("items")
  createItem(@Body() body: unknown) {
    const input = parseOrThrow(upsertWealthItemSchema, body, "Wealth item body");
    return this.wealth.createWealthItem(input);
  }

  @Patch("items/:id")
  updateItem(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(upsertWealthItemSchema, body, "Wealth item body");
    return this.wealth.updateWealthItem(id, input);
  }

  @Delete("items/:id")
  deleteItem(@Param("id") id: string) {
    return this.wealth.deleteWealthItem(id);
  }

  @Get("items/:id/series")
  getItemSeries(@Param("id") id: string) {
    return this.wealth.getWealthItemSeries(id);
  }

  @Get("items/:id/candidates")
  listItemCandidates(@Param("id") id: string) {
    return this.wealth.listWealthCandidates(id);
  }

  @Get("transactions/:transactionId")
  getTransactionWealth(@Param("transactionId") transactionId: string) {
    return this.wealth.getTransactionWealthContext(transactionId);
  }

  @Post("transactions/:transactionId/ledger")
  assignTransactionWealth(
    @Param("transactionId") transactionId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(
      assignWealthFromTransactionSchema,
      body,
      "Assign wealth from transaction body",
    );
    return this.wealth.assignWealthTransaction(
      input.itemId,
      transactionId,
      input.role,
    );
  }

  @Delete("transactions/:transactionId/ledger")
  unassignTransactionWealth(@Param("transactionId") transactionId: string) {
    return this.wealth.unassignWealthTransactionByTransaction(transactionId);
  }

  @Post("items/:id/ledger")
  assignItemTransaction(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(
      assignWealthTransactionSchema,
      body,
      "Wealth ledger body",
    );
    return this.wealth.assignWealthTransaction(id, input.transactionId, input.role);
  }

  @Delete("items/:id/ledger/:transactionId")
  unassignItemTransaction(
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
  ) {
    return this.wealth.unassignWealthTransaction(id, transactionId);
  }

  @Post("items/:id/valuations")
  addItemValuation(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(
      upsertWealthValuationSchema,
      body,
      "Wealth valuation body",
    );
    return this.wealth.addWealthValuation(id, input);
  }

  @Get("debts")
  getDebts(@Query() query: unknown) {
    const { order } = parseOrThrow(debtOrderSchema, query, "Debt order query");
    return this.wealth.getDebts(order);
  }

  @Get("holdings")
  listHoldings() {
    return this.wealth.listHoldings();
  }

  @Post("holdings")
  createHolding(@Body() body: unknown) {
    const input = parseOrThrow(upsertHoldingSchema, body, "Holding body");
    return this.wealth.createHolding(input);
  }

  @Patch("holdings/:id")
  updateHolding(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(upsertHoldingSchema, body, "Holding body");
    return this.wealth.updateHolding(id, input);
  }

  @Delete("holdings/:id")
  deleteHolding(@Param("id") id: string) {
    return this.wealth.deleteHolding(id);
  }

  @Get("pensions")
  getPensions() {
    return this.wealth.getPensions();
  }

  @Get("income")
  getIncomeMix(@Query() query: unknown) {
    const input = parseOrThrow(
      spendingPeriodQuerySchema,
      query,
      "Wealth period query",
    );
    return this.wealth.getIncomeMix(input);
  }
}
