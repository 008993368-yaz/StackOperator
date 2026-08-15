export type PathRule = {
  className: string;
  paths: string[];
  tests: string[];
};

export type WorkflowRule = {
  key: string;
  files: string[];
  names: string[];
  estimatedMinutes: number | null;
  cascadeOnFailure: boolean;
};

export type RepoRules = {
  version: 1;
  rules: PathRule[];
  workflows: WorkflowRule[];
};
