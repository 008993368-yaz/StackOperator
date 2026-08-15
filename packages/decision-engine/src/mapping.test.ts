import { expect, it } from "vitest";
import { classifyChangedFiles } from "./classify.js";
import { decideSkip } from "./decide.js";
import { ReasonCode, type DecisionContext, type WorkflowState } from "./types.js";
import type { RepoRules } from "@stackoperator/config";

it("mapping missing for a required test → RUN", () => {
  const rules: RepoRules = {
    version: 1,
    rules: [{ className: "backend", paths: ["api/**"], tests: ["integration"] }],
    workflows: [],
  };
  const classification = classifyChangedFiles(
    [{ path: "api/users.ts", status: "modified" }],
    rules,
  );
  const workflow: WorkflowState = {
    githubRunId: "9",
    workflowName: "CI",
    workflowPath: ".github/workflows/ci.yml",
    event: "pull_request",
    status: "queued",
    conclusion: null,
    headSha: "abc",
    headBranch: "feat",
  };
  const ctx: DecisionContext = {
    stacked: true,
    dataComplete: true,
    alreadyDecided: false,
    classification,
    repoRules: rules,
    workflow,
  };
  const outcome = decideSkip(ctx);
  expect(outcome.action).toBe("RUN");
  expect(outcome.reasonCode).toBe(ReasonCode.MAPPING_MISSING);
});
