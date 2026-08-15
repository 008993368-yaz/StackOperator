import { z } from "zod";
import type { NormalizedLayer, NormalizedStack, PullRequestState } from "@stackoperator/stack-core";

const remoteHeadSchema = z.object({
  ref: z.string(),
  sha: z.string(),
});

const remotePrSchema = z.object({
  number: z.number(),
  state: z.enum(["open", "closed"]),
  draft: z.boolean(),
  merged_at: z.string().nullable(),
  head: remoteHeadSchema,
});

export const remoteStackSchema = z.object({
  id: z.number(),
  number: z.number(),
  node_id: z.string(),
  url: z.string(),
  base: z.object({
    ref: z.string(),
    sha: z.string().optional(),
  }),
  open: z.boolean(),
  created_at: z.string(),
  pull_requests: z.array(remotePrSchema),
});

export type RemoteStack = z.infer<typeof remoteStackSchema>;

export type PullDetails = {
  id: number;
  number: number;
  title: string;
  baseSha: string;
  state: PullRequestState;
};

export function mapRemoteStack(
  remote: RemoteStack,
  pullDetails: ReadonlyMap<number, PullDetails>,
): NormalizedStack {
  const layers: NormalizedLayer[] = remote.pull_requests.map((pr, index) => {
    const details = pullDetails.get(pr.number);
    const parent = index === 0 ? null : (remote.pull_requests[index - 1]?.number ?? null);
    const state: PullRequestState = pr.state;
    return {
      position: index + 1,
      pullRequestNumber: pr.number,
      githubPrId: details ? String(details.id) : `pr:${pr.number}`,
      title: details?.title ?? `PR #${pr.number}`,
      headSha: pr.head.sha,
      baseSha: details?.baseSha ?? remote.base.sha ?? "",
      headRef: pr.head.ref,
      parentPullRequestNumber: parent,
      prState: details?.state ?? state,
    };
  });

  return {
    provider: "github_native",
    githubStackId: String(remote.id),
    githubStackNumber: remote.number,
    baseBranch: remote.base.ref,
    status: remote.open ? "open" : "closed",
    layers,
  };
}

export function parseRemoteStacks(data: unknown): RemoteStack[] {
  return z.array(remoteStackSchema).parse(data);
}
