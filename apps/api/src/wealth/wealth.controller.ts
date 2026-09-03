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
  addGoalAmountSchema,
  copyBudgetSchema,
  debtOrderSchema,
  spendingPeriodQuerySchema,
  upsertBillSchema,
  upsertBudgetSchema,
  upsertGoalSchema,
  upsertHoldingSchema,
  upsertWealthItemSchema,
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

  @Post("goals/:id/add")
  addGoalAmount(@Param("id") id: string, @Body() body: unknown) {
    const input = parseOrThrow(addGoalAmountSchema, body, "Add to goal body");
    return this.wealth.addGoalAmount(id, input.amount);
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
