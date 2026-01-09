import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
    prisma.$connect().catch((error) => {
      logger.error({ error }, "Failed to connect to database");
    });
  }
  return prisma;
}
