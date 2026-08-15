import { z } from "zod";
import YAML from "yaml";
import type { RepoRules } from "./types.js";

const workflowSchema = z.object({
  files: z.array(z.string()).optional(),
  names: z.array(z.string()).optional(),
  estimated_minutes: z.number().positive().optional(),
  cascade_on_failure: z.boolean().optional(),
});

const ruleSchema = z.object({
  paths: z.array(z.string()).min(1),
  tests: z.array(z.string()).min(1),
});

const configSchema = z.object({
  version: z.literal(1),
  rules: z.record(ruleSchema).optional().default({}),
  workflows: z.record(workflowSchema).optional().default({}),
});

export type ParseConfigResult =
  | { ok: true; rules: RepoRules }
  | { ok: false; error: string };

export function parseStackOperatorYaml(source: string): ParseConfigResult {
  let raw: unknown;
  try {
    raw = YAML.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid yaml";
    return { ok: false, error: message };
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }

  const rules: RepoRules = {
    version: 1,
    rules: Object.entries(parsed.data.rules).map(([className, rule]) => ({
      className,
      paths: rule.paths,
      tests: rule.tests,
    })),
    workflows: Object.entries(parsed.data.workflows).map(([key, workflow]) => ({
      key,
      files: workflow.files ?? [],
      names: workflow.names ?? [],
      estimatedMinutes: workflow.estimated_minutes ?? null,
      cascadeOnFailure: workflow.cascade_on_failure ?? true,
    })),
  };

  return { ok: true, rules };
}
