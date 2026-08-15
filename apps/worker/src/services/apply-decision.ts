import { LINUX_2CORE_SKU, loadEnv, type Logger } from "@stackoperator/shared";
import { prisma, type LayerSnapshot, type StackLayer, type WorkflowRun } from "@stackoperator/database";
import type { RepoRules } from "@stackoperator/config";
import {
  decideCascade,
  decideSkip,
  decisionIdempotencyKey,
  estimateAvoided,
  type Classification,
  type DecisionOutcome,
  type WorkflowState,
} from "@stackoperator/decision-engine";
import { cancelWorkflowRun, type InstallationClient } from "@stackoperator/github";
import { historicalAverageMinutes } from "./workflow-runs.js";

export type StackForDecision = {
  id: string;
  layers: Array<{ position: number; pullRequestNumber: number }>;
};

function toWorkflowState(run: WorkflowRun): WorkflowState {
  return {
    githubRunId: run.githubRunId,
    workflowName: run.workflowName,
    workflowPath: run.workflowPath,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.headSha,
    headBranch: run.headBranch,
  };
}

function toClassification(snapshot: LayerSnapshot | null): Classification | null {
  if (!snapshot) {
    return null;
  }
  return {
    classes: snapshot.classes,
    unmatchedPaths: snapshot.unmatchedPaths,
    testsNeeded: snapshot.testsNeeded,
    unknown: snapshot.unmatchedPaths.length > 0 || snapshot.classes.length === 0,
  };
}

export async function applyEngineDecision(input: {
  mode: "skip" | "cascade";
  octokit: InstallationClient;
  owner: string;
  repo: string;
  repositoryId: string;
  layer: StackLayer;
  stack: StackForDecision;
  workflowRun: WorkflowRun;
  rules: RepoRules | null;
  snapshot: LayerSnapshot | null;
  failedWorkflowRun?: WorkflowRun;
  logger: Logger;
}): Promise<void> {
  const already = await prisma.decision.findFirst({
    where: {
      workflowRunId: input.workflowRun.id,
      action: { in: ["SKIP", "CANCEL"] },
    },
  });

  const classification = toClassification(input.snapshot);
  const ctx = {
    stacked: true,
    dataComplete: Boolean(input.workflowRun.workflowPath || input.workflowRun.workflowName),
    alreadyDecided: already !== null,
    classification,
    repoRules: input.rules,
    workflow: toWorkflowState(input.workflowRun),
  };

  let outcome: DecisionOutcome;
  if (input.mode === "skip") {
    outcome = decideSkip(ctx);
  } else {
    if (!input.failedWorkflowRun) {
      return;
    }
    outcome = decideCascade({
      ctx,
      isDescendant: true,
      failedWorkflow: toWorkflowState(input.failedWorkflowRun),
      failedRules: input.rules,
    });
  }

  input.logger.info(
    {
      event: "decision_produced",
      stack_id: input.stack.id,
      pull_request_number: input.layer.pullRequestNumber,
      workflow_run_id: input.workflowRun.githubRunId,
      action: outcome.action,
      reasonCode: outcome.reasonCode,
    },
    "Decision produced",
  );

  if (outcome.action === "RUN") {
    const key = decisionIdempotencyKey("RUN", input.workflowRun.githubRunId, outcome.reasonCode);
    await prisma.decision.upsert({
      where: { idempotencyKey: key },
      create: {
        repositoryId: input.repositoryId,
        layerId: input.layer.id,
        workflowRunId: input.workflowRun.id,
        action: "RUN",
        reason: outcome.reason,
        reasonCode: outcome.reasonCode,
        idempotencyKey: key,
      },
      update: {},
    });
    return;
  }

  const action = outcome.action;
  const key = decisionIdempotencyKey(action, input.workflowRun.githubRunId, outcome.reasonCode);
  const existing = await prisma.decision.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    return;
  }

  input.logger.info(
    {
      event: "cancel_requested",
      workflow_run_id: input.workflowRun.githubRunId,
      reasonCode: outcome.reasonCode,
    },
    outcome.action === "SKIP" ? "Early-cancel (SKIP) requested" : "Cascade cancel requested",
  );

  try {
    const result = await cancelWorkflowRun(
      input.octokit,
      input.owner,
      input.repo,
      Number(input.workflowRun.githubRunId),
    );
    input.logger.info(
      {
        event: result === "already_cancelling" ? "cancel_succeeded" : "cancel_succeeded",
        workflow_run_id: input.workflowRun.githubRunId,
        result,
      },
      "Cancel accepted by GitHub",
    );
  } catch (error) {
    input.logger.error(
      { err: error, event: "cancel_failed", workflow_run_id: input.workflowRun.githubRunId },
      "Cancel request failed",
    );
    throw error;
  }

  const env = loadEnv();
  const historical = await historicalAverageMinutes(input.repositoryId, input.workflowRun.workflowPath);
  const savings = estimateAvoided({
    rules: input.rules,
    workflow: toWorkflowState(input.workflowRun),
    historicalAverageMinutes: historical,
    defaultEstimatedMinutes: env.DEFAULT_ESTIMATED_MINUTES,
    usdPerMinute: env.LINUX_2CORE_USD_PER_MINUTE,
    startedAt: input.workflowRun.startedAt,
    endedAt: new Date(),
  });

  try {
    const decision = await prisma.decision.create({
      data: {
        repositoryId: input.repositoryId,
        layerId: input.layer.id,
        workflowRunId: input.workflowRun.id,
        action,
        reason: outcome.reason,
        reasonCode: outcome.reasonCode,
        idempotencyKey: key,
        estimatedMinutes: savings.minutesEstimated,
        estimatedCostUsd: savings.costEstimatedUsd,
      },
    });
    await prisma.savingsEvent.create({
      data: {
        decisionId: decision.id,
        repositoryId: input.repositoryId,
        minutesEstimated: savings.minutesEstimated,
        costEstimatedUsd: savings.costEstimatedUsd,
        pricingSku: LINUX_2CORE_SKU,
        isEstimate: true,
      },
    });
    input.logger.info(
      {
        event: "savings_generated",
        decision_id: decision.id,
        workflow_run_id: input.workflowRun.githubRunId,
        minutes: savings.minutesEstimated,
        cost: savings.costEstimatedUsd,
      },
      "Estimated savings recorded",
    );
  } catch {
    input.logger.info(
      { event: "decision_duplicate", workflow_run_id: input.workflowRun.githubRunId },
      "Decision already recorded; skipping duplicate savings",
    );
  }
}
