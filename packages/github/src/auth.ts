import { createAppAuth } from "@octokit/auth-app";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "octokit";
import { GITHUB_API_VERSION } from "./version.js";

const GitHubOctokit = Octokit.plugin(retry, throttling);

export type GitHubAppCredentials = {
  appId: string;
  privateKey: string;
};

export function normalizePrivateKey(pem: string): string {
  return pem.replaceAll("\\n", "\n");
}

export function createAppOctokit(credentials: GitHubAppCredentials): InstanceType<typeof GitHubOctokit> {
  return new GitHubOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: normalizePrivateKey(credentials.privateKey),
    },
    request: {
      headers: {
        "x-github-api-version": GITHUB_API_VERSION,
      },
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: { method: string; url: string }, _octokit: unknown, retryCount: number) => {
        if (retryCount < 2) {
          return true;
        }
        void retryAfter;
        void options;
        return false;
      },
      onSecondaryRateLimit: (retryAfter: number, options: { method: string; url: string }, _octokit: unknown, retryCount: number) => {
        if (retryCount < 1) {
          return true;
        }
        void retryAfter;
        void options;
        return false;
      },
    },
  });
}

export async function installationOctokit(
  credentials: GitHubAppCredentials,
  installationId: number,
): Promise<InstanceType<typeof GitHubOctokit>> {
  return new GitHubOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: normalizePrivateKey(credentials.privateKey),
      installationId,
    },
    request: {
      headers: {
        "x-github-api-version": GITHUB_API_VERSION,
      },
    },
    throttle: {
      onRateLimit: (_retryAfter: number, _options: { method: string; url: string }, _octokit: unknown, retryCount: number) =>
        retryCount < 2,
      onSecondaryRateLimit: (
        _retryAfter: number,
        _options: { method: string; url: string },
        _octokit: unknown,
        retryCount: number,
      ) => retryCount < 1,
    },
  });
}

export type InstallationClient = InstanceType<typeof GitHubOctokit>;
