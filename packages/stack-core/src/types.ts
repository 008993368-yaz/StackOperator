export type StackProviderName = "github_native";

export type StackStatus = "open" | "closed";

export type PullRequestState = "open" | "closed";

export type FileChangeStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export type ChangedFile = {
  path: string;
  status: FileChangeStatus;
  previousPath?: string;
};

export type NormalizedLayer = {
  position: number;
  pullRequestNumber: number;
  githubPrId: string;
  title: string;
  headSha: string;
  baseSha: string;
  headRef: string;
  parentPullRequestNumber: number | null;
  prState: PullRequestState;
};

export type NormalizedStack = {
  provider: StackProviderName;
  githubStackId: string;
  githubStackNumber: number;
  baseBranch: string;
  status: StackStatus;
  layers: NormalizedLayer[];
};

export type DetectStackInput = {
  owner: string;
  repo: string;
  pullRequestNumber: number;
};

export interface StackProvider {
  detectStack(input: DetectStackInput): Promise<NormalizedStack | null>;
}

export type StackLayerRef = {
  id: string;
  position: number;
  pullRequestNumber: number;
  headSha: string;
  headRef: string;
};
