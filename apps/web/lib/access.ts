import { prisma } from "@stackoperator/database";
import { webEnv } from "./env";
import { getSession, type Session } from "./session";

export type Viewer = {
  openAccess: boolean;
  session: Session | null;
  installationIds: string[] | "all";
};

export async function getViewer(): Promise<Viewer> {
  const env = webEnv();
  if (env.DASHBOARD_OPEN_ACCESS) {
    return { openAccess: true, session: null, installationIds: "all" };
  }
  const session = await getSession();
  if (!session) {
    return { openAccess: false, session: null, installationIds: [] };
  }
  const access = await prisma.installationAccess.findMany({
    where: { userId: session.userId },
    select: { installationId: true },
  });
  return {
    openAccess: false,
    session,
    installationIds: access.map((row) => row.installationId),
  };
}

export function installationFilter(viewer: Viewer): { installationId: { in: string[] } } | object {
  if (viewer.installationIds === "all") {
    return {};
  }
  return { installationId: { in: viewer.installationIds } };
}
