import { Module } from "@nestjs/common";
import { BankController } from "./bank.controller";
import { BankService } from "./bank.service";
import { SpendingModule } from "../spending/spending.module";

@Module({
  imports: [SpendingModule],
  controllers: [BankController],
  providers: [BankService],
})
export class BankModule {}
