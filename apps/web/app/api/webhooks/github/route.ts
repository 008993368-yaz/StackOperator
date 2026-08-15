import { enqueueWebhook, persistWebhookDelivery, prisma } from "@stackoperator/database";
import {
  InvalidWebhookSignatureError,
  UnsignedWebhookError,
  parseWebhookPayload,
  verifyGitHubSignature,
  webhookMeta,
} from "@stackoperator/github";
import { createLogger } from "@stackoperator/shared";
import { webEnv } from "@/lib/env";

const log = createLogger("web.webhook");

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const env = webEnv();
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");

  if (!deliveryId || !event) {
    return Response.json({ error: "Missing GitHub delivery headers" }, { status: 400 });
  }

  try {
    await verifyGitHubSignature({
      secret: env.GITHUB_WEBHOOK_SECRET,
      rawBody,
      signature256: signature,
    });
  } catch (error) {
    if (error instanceof UnsignedWebhookError || error instanceof InvalidWebhookSignatureError) {
      log.warn({ event: "webhook_rejected", delivery: deliveryId }, error.message);
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    throw error;
  }

  let action: string | null = null;
  let installationGithubId: string | null = null;
  let repositoryFullName: string | null = null;
  let pullRequestNumber: number | null = null;
  try {
    const payload = parseWebhookPayload(rawBody);
    const meta = webhookMeta(event, payload);
    action = meta.action;
    installationGithubId = meta.installationGithubId;
    repositoryFullName = meta.repositoryFullName;
    pullRequestNumber = meta.pullRequestNumber;
  } catch (error) {
    log.warn({ err: error, event: "webhook_parse_failed" }, "Could not parse webhook envelope");
  }

  const installation = installationGithubId
    ? await prisma.installation.findUnique({
        where: { githubInstallationId: installationGithubId },
      })
    : null;

  const persisted = await persistWebhookDelivery({
    githubDeliveryId: deliveryId,
    event,
    action,
    installationId: installation?.id ?? null,
    repositoryFullName,
    pullRequestNumber,
  });

  log.info(
    {
      event: "webhook_received",
      installation_id: installationGithubId ?? undefined,
      pull_request_number: pullRequestNumber ?? undefined,
      github_event: event,
      action,
      duplicate: persisted.kind === "duplicate",
    },
    "Webhook accepted",
  );

  if (event === "ping") {
    return Response.json({ ok: true, ping: true });
  }

  if (persisted.kind === "duplicate" && persisted.status === "processed") {
    return Response.json({ ok: true, duplicate: true });
  }

  await enqueueWebhook(env.DATABASE_URL, {
    deliveryId: persisted.id,
    githubDeliveryId: deliveryId,
    event,
    action,
    installationGithubId,
    rawBody,
  });

  return Response.json({ ok: true });
}
