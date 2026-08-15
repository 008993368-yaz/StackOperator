import { NextResponse } from "next/server";
import { prisma } from "@stackoperator/database";
import { consumeOAuthState, exchangeGithubCode, listUserInstallations } from "@/lib/oauth";
import { setSessionCookie } from "@/lib/session";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !(await consumeOAuthState(state))) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const githubUser = await exchangeGithubCode(code);
  const user = await prisma.user.upsert({
    where: { githubUserId: githubUser.githubUserId },
    create: { githubUserId: githubUser.githubUserId, login: githubUser.login },
    update: { login: githubUser.login },
  });

  const installations = await listUserInstallations(githubUser.accessToken);
  for (const installation of installations) {
    const record = await prisma.installation.findUnique({
      where: { githubInstallationId: String(installation.id) },
    });
    if (!record) {
      continue;
    }
    await prisma.installationAccess.upsert({
      where: {
        userId_installationId: { userId: user.id, installationId: record.id },
      },
      create: { userId: user.id, installationId: record.id },
      update: {},
    });
  }

  await setSessionCookie({
    userId: user.id,
    login: user.login,
    githubUserId: user.githubUserId,
  });
  return NextResponse.redirect(new URL("/", url.origin));
}
