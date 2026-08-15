import { prisma } from "./client.js";
import type { NormalizedStack } from "@stackoperator/stack-core";

export async function upsertStackFromNormalized(input: {
  repositoryId: string;
  stack: NormalizedStack;
}): Promise<{ stackId: string; created: boolean }> {
  const existing = await prisma.stack.findUnique({
    where: {
      repositoryId_githubStackId: {
        repositoryId: input.repositoryId,
        githubStackId: input.stack.githubStackId,
      },
    },
  });

  const stack = await prisma.stack.upsert({
    where: {
      repositoryId_githubStackId: {
        repositoryId: input.repositoryId,
        githubStackId: input.stack.githubStackId,
      },
    },
    create: {
      repositoryId: input.repositoryId,
      provider: input.stack.provider,
      githubStackId: input.stack.githubStackId,
      githubStackNumber: input.stack.githubStackNumber,
      baseBranch: input.stack.baseBranch,
      status: input.stack.status,
    },
    update: {
      githubStackNumber: input.stack.githubStackNumber,
      baseBranch: input.stack.baseBranch,
      status: input.stack.status,
    },
  });

  const incomingNumbers = input.stack.layers.map((layer) => layer.pullRequestNumber);

  await prisma.$transaction(async (tx) => {
    for (const layer of input.stack.layers) {
      await tx.stackLayer.upsert({
        where: {
          stackId_pullRequestNumber: {
            stackId: stack.id,
            pullRequestNumber: layer.pullRequestNumber,
          },
        },
        create: {
          stackId: stack.id,
          position: layer.position,
          pullRequestNumber: layer.pullRequestNumber,
          githubPrId: layer.githubPrId,
          title: layer.title,
          headSha: layer.headSha,
          baseSha: layer.baseSha,
          headRef: layer.headRef,
          parentPullRequestNumber: layer.parentPullRequestNumber,
          prState: layer.prState,
        },
        update: {
          position: layer.position,
          githubPrId: layer.githubPrId,
          title: layer.title,
          headSha: layer.headSha,
          baseSha: layer.baseSha,
          headRef: layer.headRef,
          parentPullRequestNumber: layer.parentPullRequestNumber,
          prState: layer.prState,
        },
      });
    }

    if (incomingNumbers.length > 0) {
      await tx.stackLayer.deleteMany({
        where: {
          stackId: stack.id,
          pullRequestNumber: { notIn: incomingNumbers },
        },
      });
    }
  });

  return { stackId: stack.id, created: existing === null };
}

export async function markStackClosed(stackId: string): Promise<void> {
  await prisma.stack.update({
    where: { id: stackId },
    data: { status: "closed" },
  });
}
