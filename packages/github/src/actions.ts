import { z } from "zod";
import type { InstallationClient } from "./auth.js";

const runSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  event: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  head_sha: z.string(),
  head_branch: z.string().nullable().optional(),
  html_url: z.string(),
  run_started_at: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
});

export type GitHubWorkflowRun = z.infer<typeof runSchema>;

export async function getWorkflowRun(
  octokit: InstallationClient,
  owner: string,
  repo: string,
  runId: number,
): Promise<GitHubWorkflowRun> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
    owner,
    repo,
    run_id: runId,
  });
  return runSchema.parse(data);
}

export async function listWorkflowRunsForSha(input: {
  octokit: InstallationClient;
  owner: string;
  repo: string;
  headSha: string;
  event?: string;
}): Promise<GitHubWorkflowRun[]> {
  const { data } = await input.octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner: input.owner,
    repo: input.repo,
    head_sha: input.headSha,
    event: input.event,
    per_page: 100,
  });
  const payload = z.object({ workflow_runs: z.array(runSchema) }).parse(data);
  return payload.workflow_runs;
}

export type CancelRunResult = "cancelled" | "already_cancelling";

export async function cancelWorkflowRun(
  octokit: InstallationClient,
  owner: string,
  repo: string,
  runId: number,
): Promise<CancelRunResult> {
  try {
    await octokit.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
      owner,
      repo,
      run_id: runId,
    });
    return "cancelled";
  } catch (error) {
    if (isConflict(error)) {
      return "already_cancelling";
    }
    throw error;
  }
}

function isConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 409;
}
