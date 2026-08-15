import { describe, expect, it } from "vitest";
import { ancestorLayers, descendantLayers, parentPullRequestNumber } from "./graph.js";

const layers = [
  { position: 1, pullRequestNumber: 101 },
  { position: 2, pullRequestNumber: 102 },
  { position: 3, pullRequestNumber: 103 },
];

describe("stack graph", () => {
  it("parents the bottom layer as null", () => {
    expect(parentPullRequestNumber(layers, 101)).toBeNull();
    expect(parentPullRequestNumber(layers, 102)).toBe(101);
  });

  it("returns descendants above a failed layer", () => {
    expect(descendantLayers(layers, 101).map((layer) => layer.pullRequestNumber)).toEqual([
      102, 103,
    ]);
    expect(descendantLayers(layers, 103)).toEqual([]);
  });

  it("returns ancestors below a layer", () => {
    expect(ancestorLayers(layers, 103).map((layer) => layer.pullRequestNumber)).toEqual([
      101, 102,
    ]);
  });
});
