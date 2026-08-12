import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { SpendingController } from "./spending.controller";
import { SpendingService } from "./spending.service";

@Module({
  controllers: [SpendingController],
  providers: [SpendingService, CategoriesService],
  exports: [CategoriesService],
})
export class SpendingModule {}
