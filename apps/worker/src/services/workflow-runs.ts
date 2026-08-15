import { prisma, type StackLayer, type WorkflowRun } from "@stackoperator/database";

export async function persistWorkflowRun(input: {
  repositoryId: string;
  layerId: string | null;
  githubRunId: string;
  workflowName: string;
  workflowPath: string;
  event: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  headBranch: string | null;
  htmlUrl?: string;
  startedAt: Date | null;
  completedAt: Date | null;
}): Promise<WorkflowRun> {
  return prisma.workflowRun.upsert({
    where: { githubRunId: input.githubRunId },
    create: input,
    update: {
      layerId: input.layerId,
      workflowName: input.workflowName,
      workflowPath: input.workflowPath,
      event: input.event,
      status: input.status,
      conclusion: input.conclusion,
      headSha: input.headSha,
      headBranch: input.headBranch,
      htmlUrl: input.htmlUrl,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    },
  });
}

export type MappedRun = {
  layer: StackLayer;
  stack: {
    id: string;
    baseBranch: string;
    layers: StackLayer[];
  };
};

export async function mapRunToLayer(input: {
  repositoryId: string;
  headSha: string;
  headBranch: string | null;
}): Promise<MappedRun | null> {
  const bySha = await prisma.stackLayer.findFirst({
    where: {
      headSha: input.headSha,
      stack: { repositoryId: input.repositoryId },
    },
    include: { stack: { include: { layers: { orderBy: { position: "asc" } } } } },
  });
  if (bySha) {
    return { layer: bySha, stack: bySha.stack };
  }
  if (!input.headBranch) {
    return null;
  }
  const byBranch = await prisma.stackLayer.findFirst({
    where: {
      headRef: input.headBranch,
      stack: { repositoryId: input.repositoryId, status: "open" },
    },
    include: { stack: { include: { layers: { orderBy: { position: "asc" } } } } },
  });
  if (!byBranch) {
    return null;
  }
  return { layer: byBranch, stack: byBranch.stack };
}

export async function historicalAverageMinutes(
  repositoryId: string,
  workflowPath: string,
): Promise<number | null> {
  const runs = await prisma.workflowRun.findMany({
    where: {
      repositoryId,
      workflowPath,
      conclusion: "success",
      startedAt: { not: null },
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });
  const durations: number[] = [];
  for (const run of runs) {
    if (!run.startedAt || !run.completedAt) {
      continue;
    }
    const minutes = (run.completedAt.getTime() - run.startedAt.getTime()) / 60_000;
    if (minutes > 0) {
      durations.push(minutes);
    }
  }
  if (durations.length === 0) {
    return null;
  }
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}
