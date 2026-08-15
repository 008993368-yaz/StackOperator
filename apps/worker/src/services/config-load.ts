import { parseStackOperatorYaml, type RepoRules } from "@stackoperator/config";
import { readRepoFile, type InstallationClient } from "@stackoperator/github";

export async function loadRepoRules(input: {
  octokit: InstallationClient;
  owner: string;
  repo: string;
  ref: string;
}): Promise<RepoRules | null> {
  const source = await readRepoFile({
    octokit: input.octokit,
    owner: input.owner,
    repo: input.repo,
    path: ".stackoperator.yml",
    ref: input.ref,
  });
  if (!source) {
    return null;
  }
  const parsed = parseStackOperatorYaml(source);
  if (!parsed.ok) {
    return null;
  }
  return parsed.rules;
}
