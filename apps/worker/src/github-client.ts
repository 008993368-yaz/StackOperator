import { loadEnv, type Env } from "@stackoperator/shared";
import { installationOctokit, type GitHubAppCredentials, type InstallationClient } from "@stackoperator/github";

export function githubCredentials(env: Env = loadEnv()): GitHubAppCredentials | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return null;
  }
  return {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  };
}

export async function octokitForInstallation(githubInstallationId: string): Promise<InstallationClient> {
  const credentials = githubCredentials();
  if (!credentials) {
    throw new Error("GitHub App credentials are not configured");
  }
  return installationOctokit(credentials, Number(githubInstallationId));
}
