import type { DetectStackInput, NormalizedStack, StackProvider } from "@stackoperator/stack-core";
import type { InstallationClient } from "./auth.js";
import { previewRequest } from "./preview.js";
import { getPullDetails } from "./pulls.js";
import { mapRemoteStack, parseRemoteStacks, type PullDetails, type RemoteStack } from "./stacks.js";

export class GitHubNativeStackProvider implements StackProvider {
  constructor(private readonly octokit: InstallationClient) {}

  async detectStack(input: DetectStackInput): Promise<NormalizedStack | null> {
    const remote = await this.findStack(input.owner, input.repo, input.pullRequestNumber);
    if (!remote) {
      return null;
    }
    const details = await this.pullDetailsMap(input.owner, input.repo, remote);
    return mapRemoteStack(remote, details);
  }

  private async findStack(
    owner: string,
    repo: string,
    pullRequestNumber: number,
  ): Promise<RemoteStack | null> {
    const data = await previewRequest(this.octokit, {
      method: "GET",
      url: `/repos/${owner}/${repo}/stacks`,
      params: { pull_request: pullRequestNumber },
    });
    const stacks = parseRemoteStacks(data);
    return stacks[0] ?? null;
  }

  private async pullDetailsMap(
    owner: string,
    repo: string,
    remote: RemoteStack,
  ): Promise<Map<number, PullDetails>> {
    const entries = await Promise.all(
      remote.pull_requests.map(async (pr) => {
        const details = await getPullDetails(this.octokit, owner, repo, pr.number);
        return [pr.number, details] as const;
      }),
    );
    return new Map(entries);
  }
}
