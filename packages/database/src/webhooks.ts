import { prisma } from "./client.js";
import {
  persistWebhookDeliveryWith,
  type PersistDeliveryInput,
  type PersistDeliveryResult,
} from "./webhooks-core.js";

export type { PersistDeliveryInput, PersistDeliveryResult } from "./webhooks-core.js";
export { persistWebhookDeliveryWith } from "./webhooks-core.js";

export async function persistWebhookDelivery(
  input: PersistDeliveryInput,
): Promise<PersistDeliveryResult> {
  return persistWebhookDeliveryWith(
    {
      findByGithubDeliveryId: (githubDeliveryId) =>
        prisma.webhookDelivery.findUnique({
          where: { githubDeliveryId },
          select: { id: true, status: true },
        }),
      create: async (data) => {
        const created = await prisma.webhookDelivery.create({
          data: {
            githubDeliveryId: data.githubDeliveryId,
            event: data.event,
            action: data.action,
            installationId: data.installationId,
            repositoryFullName: data.repositoryFullName,
            pullRequestNumber: data.pullRequestNumber,
            status: "received",
          },
        });
        return { id: created.id };
      },
    },
    input,
  );
}

export async function markDeliveryProcessed(id: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id },
    data: { status: "processed", processedAt: new Date(), errorMessage: null },
  });
}

export async function markDeliveryFailed(id: string, errorMessage: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id },
    data: { status: "failed", errorMessage: errorMessage.slice(0, 2000) },
  });
}
