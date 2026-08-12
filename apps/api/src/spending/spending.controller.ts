import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  categoryIdParamSchema,
  createCategorySchema,
  recategorizeTransactionSchema,
  spendingQuerySchema,
  spendingTransactionsQuerySchema,
} from "@poca/shared";
import { parseOrThrow } from "../common/parse-or-throw";
import { CategoriesService } from "./categories.service";
import { SpendingService } from "./spending.service";

@Controller("spending")
export class SpendingController {
  constructor(
    private readonly spendingService: SpendingService,
    private readonly categoriesService: CategoriesService,
  ) {}

  private demoUserId() {
    return this.categoriesService.ensureDemoUserId();
  }

  @Get("summary")
  async getSummary(@Query() query: unknown) {
    const input = parseOrThrow(spendingQuerySchema, query, "Spending query");
    const userId = await this.demoUserId();
    return this.spendingService.getSummary(userId, input);
  }

  @Get("categories")
  async listCategories() {
    const userId = await this.demoUserId();
    return this.categoriesService.listCategories(userId);
  }

  @Post("categories")
  async createCategory(@Body() body: unknown) {
    const input = parseOrThrow(createCategorySchema, body, "Create category body");
    const userId = await this.demoUserId();
    return this.categoriesService.createCategory(userId, input);
  }

  @Post("categorize")
  async categorizeAll() {
    const userId = await this.demoUserId();
    const updated = await this.categoriesService.categorizeTransactions(userId);
    return { updatedCount: updated };
  }

  @Get("categories/:id")
  async getCategoryDetail(@Param() params: unknown, @Query() query: unknown) {
    const { id } = parseOrThrow(categoryIdParamSchema, params, "Category id");
    const input = parseOrThrow(spendingQuerySchema, query, "Spending query");
    const userId = await this.demoUserId();
    return this.spendingService.getCategoryDetail(userId, id, input);
  }

  @Get("categories/:id/transactions")
  async listCategoryTransactions(
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseOrThrow(categoryIdParamSchema, params, "Category id");
    const input = parseOrThrow(
      spendingTransactionsQuerySchema,
      query,
      "Spending transactions query",
    );
    const userId = await this.demoUserId();
    return this.spendingService.listCategoryTransactions(userId, id, input);
  }

  @Patch("transactions/:id")
  async recategorizeTransaction(
    @Param("id") transactionId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(
      recategorizeTransactionSchema,
      body,
      "Recategorize transaction body",
    );
    const userId = await this.demoUserId();
    return this.categoriesService.recategorizeTransaction(
      userId,
      transactionId,
      input,
    );
  }
}
