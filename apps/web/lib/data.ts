import { prisma } from "@stackoperator/database";
import { getViewer, installationFilter } from "./access";

export async function overviewStats() {
  const viewer = await getViewer();
  const repoWhere = installationFilter(viewer);

  const repositories = await prisma.repository.findMany({
    where: repoWhere,
    select: { id: true },
  });
  const repositoryIds = repositories.map((row) => row.id);

  const [minutes, skipped, cancelled, stacks] = await Promise.all([
    prisma.savingsEvent.aggregate({
      where: { repositoryId: { in: repositoryIds } },
      _sum: { minutesEstimated: true, costEstimatedUsd: true },
    }),
    prisma.decision.count({
      where: { repositoryId: { in: repositoryIds }, action: "SKIP" },
    }),
    prisma.decision.count({
      where: { repositoryId: { in: repositoryIds }, action: "CANCEL" },
    }),
    prisma.stack.count({
      where: { repository: repoWhere },
    }),
  ]);

  return {
    estimatedMinutes: minutes._sum.minutesEstimated ?? 0,
    estimatedCostUsd: minutes._sum.costEstimatedUsd ?? 0,
    skipped,
    cancelled,
    stacks,
    viewer,
  };
}

export async function listStacks() {
  const viewer = await getViewer();
  return prisma.stack.findMany({
    where: { repository: installationFilter(viewer) },
    orderBy: { updatedAt: "desc" },
    include: {
      repository: true,
      layers: { orderBy: { position: "asc" } },
    },
  });
}

export async function getStack(id: string) {
  const viewer = await getViewer();
  return prisma.stack.findFirst({
    where: { id, repository: installationFilter(viewer) },
    include: {
      repository: true,
      layers: {
        orderBy: { position: "asc" },
        include: {
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
          decisions: { orderBy: { createdAt: "desc" }, take: 5 },
          workflowRuns: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      },
    },
  });
}

export async function recentActivity() {
  const viewer = await getViewer();
  const repoWhere = installationFilter(viewer);
  const repositories = await prisma.repository.findMany({
    where: repoWhere,
    select: { id: true },
  });
  return prisma.decision.findMany({
    where: { repositoryId: { in: repositories.map((row) => row.id) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      layer: true,
      repository: true,
    },
  });
}
