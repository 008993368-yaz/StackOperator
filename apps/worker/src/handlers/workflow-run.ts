import { createLogger, withContext } from "@stackoperator/shared";
import { prisma } from "@stackoperator/database";
import {
  getWorkflowRun,
  type WebhookEnvelope,
} from "@stackoperator/github";
import { descendantLayers } from "@stackoperator/stack-core";
import { isBlockingConclusion } from "@stackoperator/decision-engine";
import { octokitForInstallation } from "../github-client.js";
import { ensureInstallationAndRepo } from "./installation.js";
import { applyEngineDecision } from "../services/apply-decision.js";
import { loadRepoRules } from "../services/config-load.js";
import { mapRunToLayer, persistWorkflowRun } from "../services/workflow-runs.js";

const log = createLogger("worker.workflow_run");

export async function handleWorkflowRunEvent(payload: WebhookEnvelope): Promise<void> {
  const ctx = await ensureInstallationAndRepo(payload);
  const run = payload.workflow_run;
  if (!ctx || !run) {
    return;
  }

  const logger = withContext(log, {
    installation_id: ctx.githubInstallationId,
    repository_id: ctx.repositoryId,
    workflow_run_id: run.id,
  });

  const octokit = await octokitForInstallation(ctx.githubInstallationId);
  let workflow = run;
  if (payload.action === "completed" && !run.conclusion) {
    const fresh = await getWorkflowRun(octokit, ctx.owner, ctx.repo, run.id);
    workflow = {
      ...run,
      status: fresh.status,
      conclusion: fresh.conclusion,
      path: fresh.path ?? run.path,
      name: fresh.name ?? run.name,
    };
  }

  const mapped = await mapRunToLayer({
    repositoryId: ctx.repositoryId,
    headSha: workflow.head_sha,
    headBranch: workflow.head_branch ?? null,
  });

  const record = await persistWorkflowRun({
    repositoryId: ctx.repositoryId,
    layerId: mapped?.layer.id ?? null,
    githubRunId: String(workflow.id),
    workflowName: workflow.name ?? "unknown",
    workflowPath: workflow.path ?? "",
    event: workflow.event,
    status: workflow.status,
    conclusion: workflow.conclusion ?? null,
    headSha: workflow.head_sha,
    headBranch: workflow.head_branch ?? null,
    htmlUrl: workflow.html_url,
    startedAt: workflow.run_started_at ? new Date(workflow.run_started_at) : null,
    completedAt: payload.action === "completed" ? new Date() : null,
  });

  if (!mapped) {
    logger.info({ event: "workflow_run_unmapped" }, "Could not map run to a stack layer");
    return;
  }

  const rules = await loadRepoRules({
    octokit,
    owner: ctx.owner,
    repo: ctx.repo,
    ref: mapped.stack.baseBranch,
  });

  const snapshot = await prisma.layerSnapshot.findUnique({
    where: {
      layerId_headSha: { layerId: mapped.layer.id, headSha: mapped.layer.headSha },
    },
  });

  await applyEngineDecision({
    mode: "skip",
    octokit,
    owner: ctx.owner,
    repo: ctx.repo,
    repositoryId: ctx.repositoryId,
    layer: mapped.layer,
    stack: mapped.stack,
    workflowRun: record,
    rules,
    snapshot,
    logger,
  });

  if (
    payload.action === "completed" &&
    isBlockingConclusion(record.conclusion)
  ) {
    const descendants = descendantLayers(mapped.stack.layers, mapped.layer.pullRequestNumber);
    logger.info(
      {
        event: "cascade_consider",
        stack_id: mapped.stack.id,
        pull_request_number: mapped.layer.pullRequestNumber,
        descendants: descendants.length,
      },
      "Considering cascade after upstream failure",
    );

    for (const descendant of descendants) {
      const descendantRuns = await prisma.workflowRun.findMany({
        where: { layerId: descendant.id },
      });
      for (const descendantRun of descendantRuns) {
        await applyEngineDecision({
          mode: "cascade",
          octokit,
          owner: ctx.owner,
          repo: ctx.repo,
          repositoryId: ctx.repositoryId,
          layer: descendant,
          stack: mapped.stack,
          workflowRun: descendantRun,
          rules,
          snapshot: await prisma.layerSnapshot.findUnique({
            where: {
              layerId_headSha: { layerId: descendant.id, headSha: descendant.headSha },
            },
          }),
          failedWorkflowRun: record,
          logger,
        });
      }
    }
  }
}
