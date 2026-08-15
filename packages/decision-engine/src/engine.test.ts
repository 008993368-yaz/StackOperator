import { describe, expect, it } from "vitest";
import type { RepoRules } from "@stackoperator/config";
import { classifyChangedFiles } from "./classify.js";
import { decideCascade, decideSkip } from "./decide.js";
import { ReasonCode, type DecisionContext, type WorkflowState } from "./types.js";

const rules: RepoRules = {
  version: 1,
  rules: [
    {
      className: "frontend",
      paths: ["src/components/**", "src/styles/**"],
      tests: ["unit", "frontend-e2e"],
    },
    {
      className: "backend",
      paths: ["api/**", "server/**"],
      tests: ["unit", "integration"],
    },
    {
      className: "database",
      paths: ["database/**", "migrations/**"],
      tests: ["unit", "integration", "migration"],
    },
  ],
  workflows: [
    {
      key: "unit",
      files: [".github/workflows/unit.yml"],
      names: ["Unit Tests"],
      estimatedMinutes: 5,
      cascadeOnFailure: false,
    },
    {
      key: "integration",
      files: [".github/workflows/ci.yml"],
      names: ["Integration Tests"],
      estimatedMinutes: 25,
      cascadeOnFailure: true,
    },
    {
      key: "frontend-e2e",
      files: [".github/workflows/e2e.yml"],
      names: ["Frontend E2E"],
      estimatedMinutes: 20,
      cascadeOnFailure: true,
    },
    {
      key: "mixed",
      files: [".github/workflows/mixed.yml"],
      names: ["Mixed"],
      estimatedMinutes: 30,
      cascadeOnFailure: true,
    },
  ],
};

const mixedRules: RepoRules = {
  ...rules,
  workflows: [
    ...rules.workflows,
    {
      key: "frontend-e2e",
      files: [".github/workflows/mixed.yml"],
      names: ["Mixed"],
      estimatedMinutes: 30,
      cascadeOnFailure: true,
    },
    {
      key: "integration",
      files: [".github/workflows/mixed.yml"],
      names: ["Mixed"],
      estimatedMinutes: 30,
      cascadeOnFailure: true,
    },
  ],
};

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    githubRunId: "1",
    workflowName: "Integration Tests",
    workflowPath: ".github/workflows/ci.yml",
    event: "pull_request",
    status: "queued",
    conclusion: null,
    headSha: "abc",
    headBranch: "feat/a",
    ...overrides,
  };
}

function ctx(overrides: Partial<DecisionContext> = {}): DecisionContext {
  const files = [{ path: "src/components/Button.tsx", status: "modified" as const }];
  return {
    stacked: true,
    dataComplete: true,
    alreadyDecided: false,
    classification: classifyChangedFiles(files, rules),
    repoRules: rules,
    workflow: workflow(),
    ...overrides,
  };
}

describe("classifier", () => {
  it("unions tests for mixed frontend+backend", () => {
    const result = classifyChangedFiles(
      [
        { path: "src/components/Button.tsx", status: "modified" },
        { path: "api/users.ts", status: "modified" },
      ],
      rules,
    );
    expect(result.classes).toEqual(["backend", "frontend"]);
    expect(result.testsNeeded).toEqual(["frontend-e2e", "integration", "unit"]);
    expect(result.unknown).toBe(false);
  });

  it("matches renamed files against previous and new paths", () => {
    const result = classifyChangedFiles(
      [{ path: "docs/old.md", status: "renamed", previousPath: "src/components/Button.tsx" }],
      rules,
    );
    expect(result.classes).toEqual(["frontend"]);
    expect(result.unknown).toBe(false);
  });

  it("matches deleted files that still glob", () => {
    const result = classifyChangedFiles(
      [{ path: "src/styles/theme.css", status: "removed" }],
      rules,
    );
    expect(result.classes).toEqual(["frontend"]);
  });
});

describe("decision engine safety suite", () => {
  it("unknown path → RUN", () => {
    const classification = classifyChangedFiles(
      [{ path: "README.md", status: "modified" }],
      rules,
    );
    const outcome = decideSkip(ctx({ classification }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.UNKNOWN_PATH);
  });

  it("empty diff with no rules match → RUN", () => {
    const classification = classifyChangedFiles([], rules);
    const outcome = decideSkip(ctx({ classification }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.EMPTY_DIFF);
  });

  it("missing config cannot skip → RUN", () => {
    const outcome = decideSkip(ctx({ repoRules: null }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.NO_CONFIG);
  });

  it("workflow not in controlled set → RUN", () => {
    const outcome = decideSkip(
      ctx({
        workflow: workflow({
          workflowName: "Release",
          workflowPath: ".github/workflows/release.yml",
        }),
      }),
    );
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.WORKFLOW_NOT_CONTROLLED);
  });

  it("mapping missing / incomplete data → RUN", () => {
    const outcome = decideSkip(ctx({ dataComplete: false }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.INCOMPLETE_DATA);
  });

  it("never cancels pull_request_target, schedule, workflow_dispatch, release, or push", () => {
    for (const event of [
      "pull_request_target",
      "schedule",
      "workflow_dispatch",
      "release",
      "push",
    ]) {
      const outcome = decideSkip(ctx({ workflow: workflow({ event }) }));
      expect(outcome.action).toBe("RUN");
      expect(outcome.reasonCode).toBe(ReasonCode.UNSAFE_EVENT);
    }
  });

  it("SKIP when controlled workflow tests are not needed", () => {
    const outcome = decideSkip(ctx());
    expect(outcome.action).toBe("SKIP");
    expect(outcome.reasonCode).toBe(ReasonCode.CLASSIFICATION_SKIP);
  });

  it("RUN when a required test is mapped to the workflow", () => {
    const classification = classifyChangedFiles(
      [{ path: "api/users.ts", status: "modified" }],
      rules,
    );
    const outcome = decideSkip(ctx({ classification }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.REQUIRED_TEST);
  });

  it("mixed workflow with any required test fail-safes to RUN", () => {
    const classification = classifyChangedFiles(
      [{ path: "src/components/Button.tsx", status: "modified" }],
      mixedRules,
    );
    const outcome = decideSkip(
      ctx({
        repoRules: mixedRules,
        classification,
        workflow: workflow({
          workflowName: "Mixed",
          workflowPath: ".github/workflows/mixed.yml",
        }),
      }),
    );
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.MIXED_WORKFLOW_FAILSAFE);
  });

  it("CANCEL descendants on blocking upstream failure", () => {
    const outcome = decideCascade({
      ctx: ctx({
        workflow: workflow({ githubRunId: "2", status: "in_progress" }),
      }),
      isDescendant: true,
      failedWorkflow: workflow({
        status: "completed",
        conclusion: "failure",
      }),
      failedRules: rules,
    });
    expect(outcome.action).toBe("CANCEL");
    expect(outcome.reasonCode).toBe(ReasonCode.CASCADE_UPSTREAM_FAILURE);
  });

  it("does not cascade when cascade_on_failure is false", () => {
    const outcome = decideCascade({
      ctx: ctx(),
      isDescendant: true,
      failedWorkflow: workflow({
        workflowName: "Unit Tests",
        workflowPath: ".github/workflows/unit.yml",
        status: "completed",
        conclusion: "failure",
      }),
      failedRules: rules,
    });
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.CASCADE_DISABLED);
  });

  it("no-config default: PR workflow failure on a stacked PR cascades", () => {
    const outcome = decideCascade({
      ctx: ctx({ repoRules: null }),
      isDescendant: true,
      failedWorkflow: workflow({ status: "completed", conclusion: "timed_out" }),
      failedRules: null,
    });
    expect(outcome.action).toBe("CANCEL");
    expect(outcome.reasonCode).toBe(ReasonCode.CASCADE_UPSTREAM_FAILURE);
  });

  it("ineligible status does not cancel", () => {
    const outcome = decideSkip(ctx({ workflow: workflow({ status: "completed" }) }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.INELIGIBLE_STATUS);
  });

  it("already decided run is not cancelled again", () => {
    const outcome = decideSkip(ctx({ alreadyDecided: true }));
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.ALREADY_DECIDED);
  });

  it("does not cascade onto a non-descendant layer", () => {
    const outcome = decideCascade({
      ctx: ctx(),
      isDescendant: false,
      failedWorkflow: workflow({ status: "completed", conclusion: "failure" }),
      failedRules: rules,
    });
    expect(outcome.action).toBe("RUN");
    expect(outcome.reasonCode).toBe(ReasonCode.NOT_DESCENDANT);
  });
});
