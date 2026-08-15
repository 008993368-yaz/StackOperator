import { PrismaClient } from "./generated/prisma/index.js";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from "./generated/prisma/index.js";
export type {
  Decision,
  Installation,
  LayerSnapshot,
  Organization,
  Repository,
  SavingsEvent,
  Stack,
  StackLayer,
  User,
  WebhookDelivery,
  WorkflowRun,
} from "./generated/prisma/index.js";
