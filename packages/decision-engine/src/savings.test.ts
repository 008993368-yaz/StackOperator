import { describe, expect, it } from "vitest";
import { estimateAvoided } from "./savings.js";
import type { WorkflowState } from "./types.js";
import type { RepoRules } from "@stackoperator/config";

const workflow: WorkflowState = {
  githubRunId: "1",
  workflowName: "Integration Tests",
  workflowPath: ".github/workflows/ci.yml",
  event: "pull_request",
  status: "queued",
  conclusion: null,
  headSha: "abc",
  headBranch: "feat",
};

const rules: RepoRules = {
  version: 1,
  rules: [],
  workflows: [
    {
      key: "integration",
      files: [".github/workflows/ci.yml"],
      names: ["Integration Tests"],
      estimatedMinutes: 25,
      cascadeOnFailure: true,
    },
  ],
};

describe("estimateAvoided", () => {
  it("uses config minutes minus elapsed", () => {
    const startedAt = new Date("2026-08-13T00:00:00Z");
    const endedAt = new Date("2026-08-13T00:05:00Z");
    const result = estimateAvoided({
      rules,
      workflow,
      historicalAverageMinutes: 40,
      defaultEstimatedMinutes: 15,
      usdPerMinute: 0.006,
      startedAt,
      endedAt,
    });
    expect(result.minutesEstimated).toBe(20);
    expect(result.costEstimatedUsd).toBe(0.12);
    expect(result.isEstimate).toBe(true);
  });
});
