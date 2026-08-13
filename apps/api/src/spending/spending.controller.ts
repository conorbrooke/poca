import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  categoryIdParamSchema,
  createCategorySchema,
  createTagSchema,
  recategorizeTransactionSchema,
  replaceSplitsSchema,
  spendingQuerySchema,
  spendingTransactionsQuerySchema,
  unsplitTransactionSchema,
  updateCategorySchema,
  updateSplitSchema,
  updateTagSchema,
} from "@poca/shared";
import { parseOrThrow } from "../common/parse-or-throw";
import { CategoriesService } from "./categories.service";
import { ReceiptsService } from "./receipts.service";
import { SpendingService } from "./spending.service";
import { TagsService } from "./tags.service";

@Controller("spending")
export class SpendingController {
  constructor(
    private readonly spendingService: SpendingService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly receiptsService: ReceiptsService,
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

  @Patch("categories/:id")
  async updateCategory(@Param("id") categoryId: string, @Body() body: unknown) {
    const input = parseOrThrow(updateCategorySchema, body, "Update category body");
    const userId = await this.demoUserId();
    return this.categoriesService.updateCategory(userId, categoryId, input);
  }

  @Delete("categories/:id")
  async deleteCategory(@Param("id") categoryId: string) {
    const userId = await this.demoUserId();
    return this.categoriesService.deleteCategory(userId, categoryId);
  }

  @Post("categorize")
  async categorizeAll() {
    const userId = await this.demoUserId();
    const updated = await this.categoriesService.categorizeTransactions(userId);
    return { updatedCount: updated };
  }

  @Get("tags")
  async listTags() {
    const userId = await this.demoUserId();
    return this.tagsService.listTags(userId);
  }

  @Post("tags")
  async createTag(@Body() body: unknown) {
    const input = parseOrThrow(createTagSchema, body, "Create tag body");
    const userId = await this.demoUserId();
    return this.tagsService.createTag(userId, input);
  }

  @Get("tags/:id/transactions")
  async listTagTransactions(@Param("id") tagId: string, @Query() query: unknown) {
    const input = parseOrThrow(
      spendingTransactionsQuerySchema,
      query,
      "Tag transactions query",
    );
    const userId = await this.demoUserId();
    return this.tagsService.listTagTransactions(userId, tagId, input);
  }

  @Get("tags/:id")
  async getTagSummary(@Param("id") tagId: string, @Query() query: unknown) {
    const input = parseOrThrow(spendingQuerySchema, query, "Tag summary query");
    const userId = await this.demoUserId();
    return this.tagsService.getSummary(userId, tagId, input);
  }

  @Patch("tags/:id")
  async updateTag(@Param("id") tagId: string, @Body() body: unknown) {
    const input = parseOrThrow(updateTagSchema, body, "Update tag body");
    const userId = await this.demoUserId();
    return this.tagsService.updateTag(userId, tagId, input);
  }

  @Delete("tags/:id")
  async deleteTag(@Param("id") tagId: string) {
    const userId = await this.demoUserId();
    return this.tagsService.deleteTag(userId, tagId);
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

  @Get("transactions/:id")
  async getTransaction(@Param("id") transactionId: string) {
    const userId = await this.demoUserId();
    return this.spendingService.getTransactionDetail(userId, transactionId);
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

  @Put("transactions/:id/splits")
  async replaceSplits(@Param("id") transactionId: string, @Body() body: unknown) {
    const input = parseOrThrow(replaceSplitsSchema, body, "Replace splits body");
    const userId = await this.demoUserId();
    return this.spendingService.replaceSplits(userId, transactionId, input);
  }

  @Delete("transactions/:id/splits")
  async unsplitTransaction(
    @Param("id") transactionId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(unsplitTransactionSchema, body, "Unsplit body");
    const userId = await this.demoUserId();
    return this.spendingService.unsplitTransaction(userId, transactionId, input);
  }

  @Patch("splits/:id")
  async updateSplit(@Param("id") splitId: string, @Body() body: unknown) {
    const input = parseOrThrow(updateSplitSchema, body, "Update split body");
    const userId = await this.demoUserId();
    return this.spendingService.updateSplit(userId, splitId, input);
  }

  @Post("transactions/:id/receipts")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadReceipt(
    @Param("id") transactionId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Receipt file is required");
    }
    const userId = await this.demoUserId();
    return this.receiptsService.uploadReceipt(userId, transactionId, file);
  }

  @Get("transactions/:id/receipts/:receiptId")
  async getReceipt(
    @Param("id") transactionId: string,
    @Param("receiptId") receiptId: string,
  ) {
    const userId = await this.demoUserId();
    return this.receiptsService.streamReceipt(userId, transactionId, receiptId);
  }

  @Delete("transactions/:id/receipts/:receiptId")
  async deleteReceipt(
    @Param("id") transactionId: string,
    @Param("receiptId") receiptId: string,
  ) {
    const userId = await this.demoUserId();
    return this.receiptsService.deleteReceipt(userId, transactionId, receiptId);
  }
}
