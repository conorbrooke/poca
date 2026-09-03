import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { ReceiptsService } from "./receipts.service";
import { SpendingController } from "./spending.controller";
import { SpendingService } from "./spending.service";
import { TagsService } from "./tags.service";
import { TransfersService } from "./transfers.service";

@Module({
  controllers: [SpendingController],
  providers: [
    SpendingService,
    CategoriesService,
    TagsService,
    ReceiptsService,
    TransfersService,
  ],
  exports: [CategoriesService, TransfersService],
})
export class SpendingModule {}
