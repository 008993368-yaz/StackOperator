import type { InstallationClient } from "./auth.js";

export async function previewRequest(
  octokit: InstallationClient,
  options: {
    method: "GET" | "POST" | "PATCH";
    url: string;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<unknown> {
  const { data } = await octokit.request({
    method: options.method,
    url: options.url,
    ...options.params,
  });
  return data;
}
