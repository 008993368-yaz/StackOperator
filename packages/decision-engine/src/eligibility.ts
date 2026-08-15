import type { RepoRules, WorkflowRule } from "@stackoperator/config";
import type { WorkflowState } from "./types.js";

const UNSAFE_EVENTS = new Set([
  "schedule",
  "workflow_dispatch",
  "release",
  "push",
  "pull_request_target",
]);

const CANCELABLE_STATUSES = new Set([
  "requested",
  "queued",
  "waiting",
  "pending",
  "in_progress",
]);

const BLOCKING_CONCLUSIONS = new Set(["failure", "timed_out"]);

export function isUnsafeEvent(event: string): boolean {
  return UNSAFE_EVENTS.has(event);
}

export function isPullRequestEvent(event: string): boolean {
  return event === "pull_request";
}

export function isCancelableStatus(status: string): boolean {
  return CANCELABLE_STATUSES.has(status);
}

export function isBlockingConclusion(conclusion: string | null): boolean {
  return conclusion !== null && BLOCKING_CONCLUSIONS.has(conclusion);
}

export function matchingWorkflowRules(
  rules: RepoRules | null,
  workflow: Pick<WorkflowState, "workflowName" | "workflowPath">,
): WorkflowRule[] {
  if (!rules) {
    return [];
  }
  return rules.workflows.filter((entry) => {
    const fileHit = entry.files.some((file) => file === workflow.workflowPath);
    const nameHit = entry.names.some((name) => name === workflow.workflowName);
    return fileHit || nameHit;
  });
}

export function isControlledWorkflow(
  rules: RepoRules | null,
  workflow: WorkflowState,
  stacked: boolean,
): boolean {
  if (!isPullRequestEvent(workflow.event) || isUnsafeEvent(workflow.event) || !stacked) {
    return false;
  }
  if (!rules) {
    return true;
  }
  return matchingWorkflowRules(rules, workflow).length > 0;
}

export function shouldCascadeOnFailure(
  rules: RepoRules | null,
  failedWorkflow: WorkflowState,
  stacked: boolean,
): boolean {
  if (!isControlledWorkflow(rules, failedWorkflow, stacked)) {
    return false;
  }
  if (!isBlockingConclusion(failedWorkflow.conclusion)) {
    return false;
  }
  if (!rules) {
    return true;
  }
  const matched = matchingWorkflowRules(rules, failedWorkflow);
  if (matched.length === 0) {
    return false;
  }
  return matched.some((entry) => entry.cascadeOnFailure);
}
