import { createLogger, withContext } from "@stackoperator/shared";
import { prisma, upsertStackFromNormalized } from "@stackoperator/database";
import { GitHubNativeStackProvider, type WebhookEnvelope } from "@stackoperator/github";
import { octokitForInstallation } from "../github-client.js";
import { ensureInstallationAndRepo } from "./installation.js";
import { classifyAndExplainLayer } from "../services/classify-layer.js";

const log = createLogger("worker.pull_request");

export async function handlePullRequestEvent(payload: WebhookEnvelope): Promise<void> {
  const ctx = await ensureInstallationAndRepo(payload);
  const pr = payload.pull_request;
  if (!ctx || !pr) {
    return;
  }

  const logger = withContext(log, {
    installation_id: ctx.githubInstallationId,
    repository_id: ctx.repositoryId,
    pull_request_number: pr.number,
  });

  const octokit = await octokitForInstallation(ctx.githubInstallationId);
  const provider = new GitHubNativeStackProvider(octokit);
  const detected = await provider.detectStack({
    owner: ctx.owner,
    repo: ctx.repo,
    pullRequestNumber: pr.number,
  });

  if (!detected) {
    logger.info({ event: "stack_not_found" }, "PR is not part of a GitHub stack");
    return;
  }

  const { stackId, created } = await upsertStackFromNormalized({
    repositoryId: ctx.repositoryId,
    stack: detected,
  });

  logger.info(
    {
      event: created ? "stack_detected" : "stack_changed",
      stack_id: stackId,
      github_stack_id: detected.githubStackId,
      layers: detected.layers.length,
    },
    created ? "Detected GitHub native stack" : "Refreshed GitHub native stack",
  );

  const layers = await prisma.stackLayer.findMany({
    where: { stackId },
    orderBy: { position: "asc" },
  });

  for (const layer of layers) {
    await classifyAndExplainLayer({
      octokit,
      owner: ctx.owner,
      repo: ctx.repo,
      repositoryId: ctx.repositoryId,
      stackId,
      baseRef: detected.baseBranch,
      layer,
      logger,
    });
  }
}
