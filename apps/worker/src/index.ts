import { createLogger, JOB_PROCESS_WEBHOOK, loadEnv, type WebhookJobPayload } from "@stackoperator/shared";
import { getQueue, prisma } from "@stackoperator/database";
import { processWebhookJob } from "./jobs/process-webhook.js";

const log = createLogger("worker");

async function main(): Promise<void> {
  const env = loadEnv();
  log.info({ event: "worker_starting" }, "StackOperator worker starting");
  const queue = await getQueue(env.DATABASE_URL);
  await queue.work<WebhookJobPayload>(JOB_PROCESS_WEBHOOK, async (jobs) => {
    const job = jobs[0];
    if (!job) {
      return;
    }
    await processWebhookJob(job.data);
  });
  log.info({ event: "worker_ready" }, "Worker listening for jobs");
}

async function shutdown(signal: string): Promise<void> {
  log.info({ event: "worker_shutdown", signal }, "Shutting down");
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

main().catch((error: unknown) => {
  log.error({ err: error, event: "worker_crash" }, "Worker failed to start");
  process.exit(1);
});
