import { z } from "zod";
import type { InstallationClient } from "./auth.js";

const contentSchema = z.object({
  type: z.literal("file"),
  encoding: z.string(),
  content: z.string(),
});

export async function readRepoFile(input: {
  octokit: InstallationClient;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}): Promise<string | null> {
  try {
    const { data } = await input.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.ref,
    });
    const parsed = contentSchema.safeParse(data);
    if (!parsed.success) {
      return null;
    }
    if (parsed.data.encoding !== "base64") {
      return parsed.data.content;
    }
    return Buffer.from(parsed.data.content, "base64").toString("utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}
