import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { webEnv } from "./env";

const STATE_COOKIE = "stackoperator_oauth_state";

export async function githubAuthorizeRedirect(): Promise<string> {
  const env = webEnv();
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_BASE_URL}/api/auth/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function consumeOAuthState(state: string | null): Promise<boolean> {
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  return Boolean(state && expected && state === expected);
}

export async function exchangeGithubCode(code: string): Promise<{
  login: string;
  githubUserId: string;
  accessToken: string;
}> {
  const env = webEnv();
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_BASE_URL}/api/auth/callback`,
    }),
  });
  const tokenBody: unknown = await tokenRes.json();
  const accessToken =
    typeof tokenBody === "object" &&
    tokenBody !== null &&
    "access_token" in tokenBody &&
    typeof tokenBody.access_token === "string"
      ? tokenBody.access_token
      : null;
  if (!accessToken) {
    throw new Error("GitHub OAuth token exchange failed");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  const userBody: unknown = await userRes.json();
  if (
    typeof userBody !== "object" ||
    userBody === null ||
    !("id" in userBody) ||
    !("login" in userBody) ||
    typeof userBody.id !== "number" ||
    typeof userBody.login !== "string"
  ) {
    throw new Error("GitHub user lookup failed");
  }
  return {
    login: userBody.login,
    githubUserId: String(userBody.id),
    accessToken,
  };
}

export type GithubInstallation = {
  id: number;
  account: { login: string; id: number; type?: string } | null;
};

export async function listUserInstallations(accessToken: string): Promise<GithubInstallation[]> {
  const res = await fetch("https://api.github.com/user/installations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null || !("installations" in body)) {
    return [];
  }
  const installations = body.installations;
  if (!Array.isArray(installations)) {
    return [];
  }
  return installations.filter((item): item is GithubInstallation => {
    return typeof item === "object" && item !== null && "id" in item && typeof item.id === "number";
  });
}
