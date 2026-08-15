import { createLogger, withContext } from "@stackoperator/shared";
import { prisma } from "@stackoperator/database";
import type { WebhookEnvelope } from "@stackoperator/github";

const log = createLogger("worker.installation");

export async function handleInstallationEvent(event: string, payload: WebhookEnvelope): Promise<void> {
  const installation = payload.installation;
  if (!installation) {
    return;
  }

  const logger = withContext(log, { installation_id: installation.id });
  const action = payload.action ?? "";

  if (event === "installation" && action === "deleted") {
    await prisma.installation.deleteMany({
      where: { githubInstallationId: String(installation.id) },
    });
    logger.info({ event: "installation_deleted" }, "Removed installation");
    return;
  }

  const account = installation.account;
  if (!account) {
    logger.warn({ event: "installation_incomplete" }, "Installation payload missing account");
    return;
  }

  const organization = await prisma.organization.upsert({
    where: { githubAccountId: String(account.id) },
    create: {
      githubAccountId: String(account.id),
      login: account.login,
      accountType: account.type ?? "Organization",
    },
    update: {
      login: account.login,
      accountType: account.type ?? "Organization",
    },
  });

  const suspendedAt =
    action === "suspend"
      ? new Date()
      : action === "unsuspend"
        ? null
        : installation.suspended_at
          ? new Date(installation.suspended_at)
          : undefined;

  const record = await prisma.installation.upsert({
    where: { githubInstallationId: String(installation.id) },
    create: {
      githubInstallationId: String(installation.id),
      organizationId: organization.id,
      suspendedAt: suspendedAt instanceof Date ? suspendedAt : null,
    },
    update: {
      organizationId: organization.id,
      ...(suspendedAt !== undefined ? { suspendedAt } : {}),
    },
  });

  const added =
    event === "installation_repositories"
      ? (payload.repositories_added ?? [])
      : (payload.repositories ?? []);
  for (const repo of added) {
    await prisma.repository.upsert({
      where: { githubRepoId: String(repo.id) },
      create: {
        githubRepoId: String(repo.id),
        installationId: record.id,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch ?? "main",
      },
      update: {
        installationId: record.id,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch ?? "main",
      },
    });
  }

  if (event === "installation_repositories") {
    for (const repo of payload.repositories_removed ?? []) {
      await prisma.repository.deleteMany({
        where: { githubRepoId: String(repo.id) },
      });
    }
  }

  logger.info({ event: "installation_synced", action }, "Installation synced");
}

export async function ensureInstallationAndRepo(payload: WebhookEnvelope): Promise<{
  installationId: string;
  repositoryId: string;
  githubInstallationId: string;
  owner: string;
  repo: string;
  fullName: string;
} | null> {
  if (!payload.installation || !payload.repository) {
    return null;
  }
  await handleInstallationEvent("installation", {
    ...payload,
    action: "created",
    repositories: [payload.repository],
  });
  const installation = await prisma.installation.findUnique({
    where: { githubInstallationId: String(payload.installation.id) },
  });
  const repository = await prisma.repository.findUnique({
    where: { githubRepoId: String(payload.repository.id) },
  });
  if (!installation || !repository) {
    return null;
  }
  const [owner, repo] = payload.repository.full_name.split("/");
  if (!owner || !repo) {
    return null;
  }
  return {
    installationId: installation.id,
    repositoryId: repository.id,
    githubInstallationId: installation.githubInstallationId,
    owner,
    repo,
    fullName: payload.repository.full_name,
  };
}
