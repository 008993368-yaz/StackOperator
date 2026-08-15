import { z } from "zod";
import type { ChangedFile, FileChangeStatus } from "@stackoperator/stack-core";
import type { InstallationClient } from "./auth.js";
import type { PullDetails } from "./stacks.js";

const fileSchema = z.object({
  filename: z.string(),
  status: z.string(),
  previous_filename: z.string().optional(),
});

const pullSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  base: z.object({ sha: z.string() }),
});

function mapStatus(status: string): FileChangeStatus {
  switch (status) {
    case "added":
    case "modified":
    case "removed":
    case "renamed":
    case "copied":
    case "changed":
    case "unchanged":
      return status;
    default:
      return "modified";
  }
}

export async function listPullFiles(
  octokit: InstallationClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<ChangedFile[]> {
  const files = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return files.map((file) => {
    const parsed = fileSchema.parse(file);
    const changed: ChangedFile = {
      path: parsed.filename,
      status: mapStatus(parsed.status),
    };
    if (parsed.previous_filename) {
      changed.previousPath = parsed.previous_filename;
    }
    return changed;
  });
}

export async function getPullDetails(
  octokit: InstallationClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullDetails> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const parsed = pullSchema.parse(data);
  return {
    id: parsed.id,
    number: parsed.number,
    title: parsed.title,
    baseSha: parsed.base.sha,
    state: parsed.state,
  };
}
