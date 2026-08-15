import type { RepoRules } from "@stackoperator/config";

export const ReasonCode = {
  UNKNOWN_PATH: "UNKNOWN_PATH",
  NO_CONFIG: "NO_CONFIG",
  WORKFLOW_NOT_CONTROLLED: "WORKFLOW_NOT_CONTROLLED",
  MAPPING_MISSING: "MAPPING_MISSING",
  INCOMPLETE_DATA: "INCOMPLETE_DATA",
  UNSAFE_EVENT: "UNSAFE_EVENT",
  NOT_PULL_REQUEST_EVENT: "NOT_PULL_REQUEST_EVENT",
  NOT_STACKED: "NOT_STACKED",
  ALREADY_DECIDED: "ALREADY_DECIDED",
  CLASSIFICATION_SKIP: "CLASSIFICATION_SKIP",
  CASCADE_UPSTREAM_FAILURE: "CASCADE_UPSTREAM_FAILURE",
  REQUIRED_TEST: "REQUIRED_TEST",
  MIXED_WORKFLOW_FAILSAFE: "MIXED_WORKFLOW_FAILSAFE",
  EMPTY_DIFF: "EMPTY_DIFF",
  INELIGIBLE_STATUS: "INELIGIBLE_STATUS",
  CASCADE_DISABLED: "CASCADE_DISABLED",
  NOT_DESCENDANT: "NOT_DESCENDANT",
  NOT_BLOCKING_FAILURE: "NOT_BLOCKING_FAILURE",
} as const;

export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

export type CIDecision = "RUN" | "SKIP" | "CANCEL";

export type DecisionOutcome = {
  action: CIDecision;
  reason: string;
  reasonCode: ReasonCode;
};

export type WorkflowState = {
  githubRunId: string;
  workflowName: string;
  workflowPath: string;
  event: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  headBranch: string | null;
};

export type Classification = {
  classes: string[];
  unmatchedPaths: string[];
  testsNeeded: string[];
  unknown: boolean;
};

export type DecisionContext = {
  stacked: boolean;
  dataComplete: boolean;
  alreadyDecided: boolean;
  classification: Classification | null;
  repoRules: RepoRules | null;
  workflow: WorkflowState;
};
