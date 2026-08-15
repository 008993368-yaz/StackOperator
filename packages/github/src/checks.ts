import { z } from "zod";
import type { InstallationClient } from "./auth.js";

const checkRunSchema = z.object({
  id: z.number(),
});

export async function upsertStackOperatorCheck(input: {
  octokit: InstallationClient;
  owner: string;
  repo: string;
  headSha: string;
  title: string;
  summary: string;
  existingId?: string | null;
  detailsUrl?: string;
}): Promise<string> {
  const body = {
    name: "StackOperator",
    head_sha: input.headSha,
    status: "completed" as const,
    conclusion: "neutral" as const,
    details_url: input.detailsUrl,
    output: {
      title: input.title,
      summary: input.summary,
    },
  };

  if (input.existingId) {
    const { data } = await input.octokit.request(
      "PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}",
      {
        owner: input.owner,
        repo: input.repo,
        check_run_id: Number(input.existingId),
        ...body,
      },
    );
    return String(checkRunSchema.parse(data).id);
  }

  const { data } = await input.octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    owner: input.owner,
    repo: input.repo,
    ...body,
  });
  return String(checkRunSchema.parse(data).id);
}
