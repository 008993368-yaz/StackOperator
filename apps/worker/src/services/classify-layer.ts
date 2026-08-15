import { prisma, type StackLayer } from "@stackoperator/database";
import { classifyChangedFiles } from "@stackoperator/decision-engine";
import {
  listPullFiles,
  listWorkflowRunsForSha,
  upsertStackOperatorCheck,
  type InstallationClient,
} from "@stackoperator/github";
import { loadEnv, type Logger } from "@stackoperator/shared";
import { applyEngineDecision } from "./apply-decision.js";
import { loadRepoRules } from "./config-load.js";
import { persistWorkflowRun } from "./workflow-runs.js";

export async function classifyAndExplainLayer(input: {
  octokit: InstallationClient;
  owner: string;
  repo: string;
  repositoryId: string;
  stackId: string;
  baseRef: string;
  layer: StackLayer;
  logger: Logger;
}): Promise<void> {
  const files = await listPullFiles(
    input.octokit,
    input.owner,
    input.repo,
    input.layer.pullRequestNumber,
  );
  const rules = await loadRepoRules({
    octokit: input.octokit,
    owner: input.owner,
    repo: input.repo,
    ref: input.baseRef,
  });
  const classification = classifyChangedFiles(files, rules);

  input.logger.info(
    {
      event: "diff_classified",
      stack_id: input.stackId,
      pull_request_number: input.layer.pullRequestNumber,
      classes: classification.classes,
      unmatched: classification.unmatchedPaths.length,
    },
    "Classified layer paths",
  );

  const existing = await prisma.layerSnapshot.findUnique({
    where: {
      layerId_headSha: { layerId: input.layer.id, headSha: input.layer.headSha },
    },
  });

  const env = loadEnv();
  const title = classification.unknown
    ? "Fail-safe RUN"
    : `Classes: ${classification.classes.join(", ") || "none"}`;
  const summary = [
    classification.unknown
      ? "Unmatched or unknown paths — StackOperator will not skip CI."
      : `Required tests: ${classification.testsNeeded.join(", ") || "none"}.`,
    classification.unmatchedPaths.length > 0
      ? `Unmatched paths: ${classification.unmatchedPaths.join(", ")}`
      : null,
    "SKIP is executed as an early cancel of a controlled workflow.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n\n");

  const checkRunId = await upsertStackOperatorCheck({
    octokit: input.octokit,
    owner: input.owner,
    repo: input.repo,
    headSha: input.layer.headSha,
    title,
    summary,
    existingId: existing?.githubCheckRunId,
    detailsUrl: `${env.APP_BASE_URL}/stacks/${input.stackId}`,
  });

  await prisma.layerSnapshot.upsert({
    where: {
      layerId_headSha: { layerId: input.layer.id, headSha: input.layer.headSha },
    },
    create: {
      layerId: input.layer.id,
      headSha: input.layer.headSha,
      classes: classification.classes,
      unmatchedPaths: classification.unmatchedPaths,
      testsNeeded: classification.testsNeeded,
      githubCheckRunId: checkRunId,
    },
    update: {
      classes: classification.classes,
      unmatchedPaths: classification.unmatchedPaths,
      testsNeeded: classification.testsNeeded,
      githubCheckRunId: checkRunId,
    },
  });

  const snapshot = await prisma.layerSnapshot.findUnique({
    where: {
      layerId_headSha: { layerId: input.layer.id, headSha: input.layer.headSha },
    },
  });

  const githubRuns = await listWorkflowRunsForSha({
    octokit: input.octokit,
    owner: input.owner,
    repo: input.repo,
    headSha: input.layer.headSha,
    event: "pull_request",
  });

  const stackLayers = await prisma.stackLayer.findMany({
    where: { stackId: input.stackId },
    orderBy: { position: "asc" },
  });

  for (const githubRun of githubRuns) {
    const workflowRun = await persistWorkflowRun({
      repositoryId: input.repositoryId,
      layerId: input.layer.id,
      githubRunId: String(githubRun.id),
      workflowName: githubRun.name ?? "unknown",
      workflowPath: githubRun.path ?? "",
      event: githubRun.event,
      status: githubRun.status,
      conclusion: githubRun.conclusion,
      headSha: githubRun.head_sha,
      headBranch: githubRun.head_branch ?? null,
      htmlUrl: githubRun.html_url,
      startedAt: githubRun.run_started_at ? new Date(githubRun.run_started_at) : null,
      completedAt: githubRun.conclusion ? new Date() : null,
    });
    await applyEngineDecision({
      mode: "skip",
      octokit: input.octokit,
      owner: input.owner,
      repo: input.repo,
      repositoryId: input.repositoryId,
      layer: input.layer,
      stack: { id: input.stackId, layers: stackLayers },
      workflowRun,
      rules,
      snapshot,
      logger: input.logger,
    });
  }
}
