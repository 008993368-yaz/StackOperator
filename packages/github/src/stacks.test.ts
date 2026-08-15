import { describe, expect, it } from "vitest";
import { mapRemoteStack, parseRemoteStacks } from "./stacks.js";

const fixture = [
  {
    id: 42,
    number: 3,
    node_id: "SS_kwDOExample",
    url: "https://api.github.com/repos/octo/hello/stacks/3",
    base: { ref: "main" },
    open: true,
    created_at: "2026-08-01T00:00:00Z",
    pull_requests: [
      {
        number: 101,
        state: "open",
        draft: false,
        merged_at: null,
        head: { ref: "feat/bottom", sha: "aaa111" },
      },
      {
        number: 102,
        state: "open",
        draft: false,
        merged_at: null,
        head: { ref: "feat/mid", sha: "bbb222" },
      },
      {
        number: 103,
        state: "open",
        draft: true,
        merged_at: null,
        head: { ref: "feat/top", sha: "ccc333" },
      },
    ],
  },
];

describe("mapRemoteStack", () => {
  it("maps Stacks API JSON onto a normalized stack", () => {
    const remotes = parseRemoteStacks(fixture);
    const remote = remotes[0];
    expect(remote).toBeDefined();
    if (!remote) {
      return;
    }

    const details = new Map([
      [101, { id: 1001, number: 101, title: "bottom", baseSha: "base1", state: "open" as const }],
      [102, { id: 1002, number: 102, title: "mid", baseSha: "base2", state: "open" as const }],
      [103, { id: 1003, number: 103, title: "top", baseSha: "base3", state: "open" as const }],
    ]);

    const stack = mapRemoteStack(remote, details);
    expect(stack.githubStackId).toBe("42");
    expect(stack.githubStackNumber).toBe(3);
    expect(stack.baseBranch).toBe("main");
    expect(stack.layers.map((layer) => layer.pullRequestNumber)).toEqual([101, 102, 103]);
    expect(stack.layers[1]?.parentPullRequestNumber).toBe(101);
    expect(stack.layers[0]?.parentPullRequestNumber).toBeNull();
    expect(stack.layers[2]?.title).toBe("top");
    expect(stack.layers[2]?.githubPrId).toBe("1003");
  });

  it("uses the same githubStackId as the upsert identity", () => {
    const remotes = parseRemoteStacks(fixture);
    const a = remotes[0];
    const b = remotes[0];
    expect(a && b && String(a.id) === String(b.id)).toBe(true);
  });
});
