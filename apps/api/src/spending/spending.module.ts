import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { ReceiptsService } from "./receipts.service";
import { SpendingController } from "./spending.controller";
import { SpendingService } from "./spending.service";
import { TagsService } from "./tags.service";

@Module({
  controllers: [SpendingController],
  providers: [SpendingService, CategoriesService, TagsService, ReceiptsService],
  exports: [CategoriesService],
})
export class SpendingModule {}
