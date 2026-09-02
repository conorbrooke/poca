import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BankModule } from "./bank/bank.module";
import { FxModule } from "./fx/fx.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SpendingModule } from "./spending/spending.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    PrismaModule,
    FxModule,
    HealthModule,
    BankModule,
    SpendingModule,
  ],
})
export class AppModule {}
