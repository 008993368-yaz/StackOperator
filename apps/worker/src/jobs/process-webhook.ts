import { createLogger, withContext, type WebhookJobPayload } from "@stackoperator/shared";
import { markDeliveryFailed, markDeliveryProcessed } from "@stackoperator/database";
import { parseWebhookPayload } from "@stackoperator/github";
import { handleInstallationEvent } from "../handlers/installation.js";
import { handlePullRequestEvent } from "../handlers/pull-request.js";
import { handleWorkflowRunEvent } from "../handlers/workflow-run.js";

const log = createLogger("worker.webhook");

const PR_ACTIONS = new Set(["opened", "reopened", "synchronize", "closed", "stacked", "edited"]);
const WORKFLOW_ACTIONS = new Set(["requested", "in_progress", "completed"]);
const INSTALLATION_EVENTS = new Set(["installation", "installation_repositories"]);

export async function processWebhookJob(payload: WebhookJobPayload): Promise<void> {
  const logger = withContext(log, {
    installation_id: payload.installationGithubId ?? undefined,
  });

  try {
    if (payload.event === "ping") {
      await markDeliveryProcessed(payload.deliveryId);
      logger.info({ event: "webhook_processed" }, "Ignored ping");
      return;
    }

    const body = parseWebhookPayload(payload.rawBody);

    if (INSTALLATION_EVENTS.has(payload.event)) {
      await handleInstallationEvent(payload.event, body);
    } else if (payload.event === "pull_request" && payload.action && PR_ACTIONS.has(payload.action)) {
      await handlePullRequestEvent(body);
    } else if (payload.event === "workflow_run" && payload.action && WORKFLOW_ACTIONS.has(payload.action)) {
      await handleWorkflowRunEvent(body);
    } else {
      logger.info(
        { event: "webhook_processed", github_event: payload.event, action: payload.action },
        "No handler for event",
      );
    }

    await markDeliveryProcessed(payload.deliveryId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await markDeliveryFailed(payload.deliveryId, message);
    logger.error({ err: error, event: "webhook_failed" }, "Webhook job failed");
    throw error;
  }
}
