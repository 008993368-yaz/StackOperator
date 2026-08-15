import PgBoss from "pg-boss";
import { JOB_PROCESS_WEBHOOK, type WebhookJobPayload } from "@stackoperator/shared";

let boss: PgBoss | undefined;

export async function getQueue(connectionString: string): Promise<PgBoss> {
  if (boss) {
    return boss;
  }
  const instance = new PgBoss({
    connectionString,
    application_name: "stackoperator",
    schema: "pgboss",
  });
  instance.on("error", (error: unknown) => {
    console.error("pg-boss error", error);
  });
  await instance.start();
  await instance.createQueue(JOB_PROCESS_WEBHOOK, {
    name: JOB_PROCESS_WEBHOOK,
    retryLimit: 8,
    retryDelay: 15,
    retryBackoff: true,
  });
  boss = instance;
  return instance;
}

export async function enqueueWebhook(
  connectionString: string,
  payload: WebhookJobPayload,
): Promise<string | null> {
  const queue = await getQueue(connectionString);
  return queue.send(JOB_PROCESS_WEBHOOK, payload, {
    singletonKey: payload.githubDeliveryId,
  });
}

export async function stopQueue(): Promise<void> {
  if (!boss) {
    return;
  }
  await boss.stop({ graceful: true, timeout: 10_000 });
  boss = undefined;
}
