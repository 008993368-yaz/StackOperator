import { describe, expect, it } from "vitest";
import { parseStackOperatorYaml } from "./parse.js";

const sample = `
version: 1
rules:
  frontend:
    paths: ["src/components/**", "src/styles/**"]
    tests: [unit, frontend-e2e]
  backend:
    paths: ["api/**", "server/**"]
    tests: [unit, integration]
workflows:
  integration:
    files: [".github/workflows/ci.yml"]
    names: ["Integration Tests"]
    estimated_minutes: 25
    cascade_on_failure: true
`;

describe("parseStackOperatorYaml", () => {
  it("parses v1 config", () => {
    const result = parseStackOperatorYaml(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rules.rules.map((rule) => rule.className)).toEqual(["frontend", "backend"]);
    expect(result.rules.workflows[0]?.estimatedMinutes).toBe(25);
  });

  it("rejects invalid yaml", () => {
    const result = parseStackOperatorYaml("version: [");
    expect(result.ok).toBe(false);
  });

  it("rejects missing version", () => {
    const result = parseStackOperatorYaml("rules: {}");
    expect(result.ok).toBe(false);
  });
});
