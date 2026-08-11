import path from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/client";

config({ path: path.resolve(__dirname, "../../../.env") });

function createAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return new PrismaPg({ connectionString });
}

export function createPrismaClientOptions(): Prisma.PrismaClientOptions {
  return {
    adapter: createAdapter(),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  };
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient(createPrismaClientOptions());
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from "./generated/client";
export * from "./generated/client";
