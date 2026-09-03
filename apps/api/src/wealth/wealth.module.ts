import { Module } from "@nestjs/common";
import { SpendingModule } from "../spending/spending.module";
import { WealthController } from "./wealth.controller";
import { WealthService } from "./wealth.service";

@Module({
  imports: [SpendingModule],
  controllers: [WealthController],
  providers: [WealthService],
})
export class WealthModule {}
