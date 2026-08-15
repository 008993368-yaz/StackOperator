import type { RepoRules } from "@stackoperator/config";
import type { DecisionContext, DecisionOutcome, WorkflowState } from "./types.js";
import { ReasonCode } from "./types.js";
import {
  isCancelableStatus,
  isControlledWorkflow,
  isPullRequestEvent,
  isUnsafeEvent,
  matchingWorkflowRules,
  shouldCascadeOnFailure,
} from "./eligibility.js";

function run(reasonCode: (typeof ReasonCode)[keyof typeof ReasonCode], reason: string): DecisionOutcome {
  return { action: "RUN", reasonCode, reason };
}

function failSafeIncomplete(ctx: DecisionContext): DecisionOutcome | null {
  if (!ctx.dataComplete) {
    return run(ReasonCode.INCOMPLETE_DATA, "GitHub data is incomplete; fail-safe RUN");
  }
  if (!ctx.stacked) {
    return run(ReasonCode.NOT_STACKED, "Pull request is not part of a stack; fail-safe RUN");
  }
  if (ctx.alreadyDecided) {
    return run(ReasonCode.ALREADY_DECIDED, "A terminal decision already exists for this run");
  }
  if (isUnsafeEvent(ctx.workflow.event) || !isPullRequestEvent(ctx.workflow.event)) {
    return run(
      ReasonCode.UNSAFE_EVENT,
      `Event ${ctx.workflow.event} is not eligible for cancellation; fail-safe RUN`,
    );
  }
  return null;
}

export function decideSkip(ctx: DecisionContext): DecisionOutcome {
  const blocked = failSafeIncomplete(ctx);
  if (blocked) {
    return blocked;
  }
  if (!isCancelableStatus(ctx.workflow.status)) {
    return run(ReasonCode.INELIGIBLE_STATUS, `Run status ${ctx.workflow.status} cannot be cancelled`);
  }

  const rules = ctx.repoRules;
  if (!rules) {
    return run(ReasonCode.NO_CONFIG, "No .stackoperator.yml; cannot classify a skip");
  }

  const classification = ctx.classification;
  if (!classification) {
    return run(ReasonCode.INCOMPLETE_DATA, "Classification is missing; fail-safe RUN");
  }
  if (classification.unknown) {
    if (classification.unmatchedPaths.length === 0) {
      return run(ReasonCode.EMPTY_DIFF, "Empty or unmatched diff; fail-safe RUN");
    }
    return run(
      ReasonCode.UNKNOWN_PATH,
      `Unmatched paths: ${classification.unmatchedPaths.join(", ")}; fail-safe RUN`,
    );
  }

  const workflowKeys = new Set(rules.workflows.map((entry) => entry.key));
  if (classification.testsNeeded.some((test) => !workflowKeys.has(test))) {
    return run(
      ReasonCode.MAPPING_MISSING,
      "A required test has no workflow mapping; fail-safe RUN",
    );
  }

  const matched = matchingWorkflowRules(rules, ctx.workflow);
  if (matched.length === 0) {
    return run(
      ReasonCode.WORKFLOW_NOT_CONTROLLED,
      "Workflow is not in the controlled set; fail-safe RUN",
    );
  }

  const provided = new Set(matched.map((entry) => entry.key));
  const needed = new Set(classification.testsNeeded);
  const overlap = [...provided].filter((key) => needed.has(key));

  if (overlap.length === 0) {
    if ([...provided].some((key) => !rules.workflows.some((workflow) => workflow.key === key))) {
      return run(ReasonCode.MAPPING_MISSING, "Workflow mapping is missing; fail-safe RUN");
    }
    return {
      action: "SKIP",
      reasonCode: ReasonCode.CLASSIFICATION_SKIP,
      reason: `None of ${[...provided].join(", ")} are required for classes ${classification.classes.join(", ")}`,
    };
  }

  if (provided.size > 1 && overlap.length < provided.size) {
    return run(
      ReasonCode.MIXED_WORKFLOW_FAILSAFE,
      "Workflow provides mixed tests and at least one is required; fail-safe RUN",
    );
  }

  return run(
    ReasonCode.REQUIRED_TEST,
    `Required tests: ${overlap.join(", ")}`,
  );
}

export function decideCascade(input: {
  ctx: DecisionContext;
  isDescendant: boolean;
  failedWorkflow: WorkflowState;
  failedRules: RepoRules | null;
}): DecisionOutcome {
  const blocked = failSafeIncomplete(input.ctx);
  if (blocked) {
    return blocked;
  }
  if (!input.isDescendant) {
    return run(ReasonCode.NOT_DESCENDANT, "Run is not on a descendant layer");
  }
  if (!isCancelableStatus(input.ctx.workflow.status)) {
    return run(ReasonCode.INELIGIBLE_STATUS, `Run status ${input.ctx.workflow.status} cannot be cancelled`);
  }
  if (!shouldCascadeOnFailure(input.failedRules, input.failedWorkflow, true)) {
    return run(
      ReasonCode.CASCADE_DISABLED,
      "Upstream failure is not a blocking cascade trigger",
    );
  }
  if (!isControlledWorkflow(input.ctx.repoRules, input.ctx.workflow, true)) {
    return run(
      ReasonCode.WORKFLOW_NOT_CONTROLLED,
      "Descendant workflow is not in the controlled set; fail-safe RUN",
    );
  }
  return {
    action: "CANCEL",
    reasonCode: ReasonCode.CASCADE_UPSTREAM_FAILURE,
    reason: `Upstream workflow ${input.failedWorkflow.workflowName} failed; cancelling descendant run`,
  };
}

export function decisionIdempotencyKey(action: "SKIP" | "CANCEL" | "RUN", githubRunId: string, reasonCode: string): string {
  return `${action.toLowerCase()}:${githubRunId}:${reasonCode}`;
}
