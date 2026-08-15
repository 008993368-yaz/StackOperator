-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "githubAccountId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallationAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "githubDeliveryId" TEXT NOT NULL,
    "installationId" TEXT,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "status" TEXT NOT NULL,
    "repositoryFullName" TEXT,
    "pullRequestNumber" INTEGER,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stack" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "githubStackId" TEXT NOT NULL,
    "githubStackNumber" INTEGER NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackLayer" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pullRequestNumber" INTEGER NOT NULL,
    "githubPrId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "headRef" TEXT NOT NULL DEFAULT '',
    "parentPullRequestNumber" INTEGER,
    "prState" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StackLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LayerSnapshot" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "classes" TEXT[],
    "unmatchedPaths" TEXT[],
    "testsNeeded" TEXT[],
    "githubCheckRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LayerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "githubRunId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "layerId" TEXT,
    "workflowName" TEXT NOT NULL,
    "workflowPath" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "headSha" TEXT NOT NULL,
    "headBranch" TEXT,
    "htmlUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "layerId" TEXT,
    "workflowRunId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "estimatedMinutes" DOUBLE PRECISION,
    "estimatedCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsEvent" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "minutesEstimated" DOUBLE PRECISION NOT NULL,
    "costEstimatedUsd" DOUBLE PRECISION NOT NULL,
    "pricingSku" TEXT NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUserId_key" ON "User"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_githubAccountId_key" ON "Organization"("githubAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_githubInstallationId_key" ON "Installation"("githubInstallationId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationAccess_userId_installationId_key" ON "InstallationAccess"("userId", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubRepoId_key" ON "Repository"("githubRepoId");

-- CreateIndex
CREATE INDEX "Repository_installationId_fullName_idx" ON "Repository"("installationId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_githubDeliveryId_key" ON "WebhookDelivery"("githubDeliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "Stack_repositoryId_githubStackId_key" ON "Stack"("repositoryId", "githubStackId");

-- CreateIndex
CREATE INDEX "StackLayer_stackId_position_idx" ON "StackLayer"("stackId", "position");

-- CreateIndex
CREATE INDEX "StackLayer_headSha_idx" ON "StackLayer"("headSha");

-- CreateIndex
CREATE UNIQUE INDEX "StackLayer_stackId_pullRequestNumber_key" ON "StackLayer"("stackId", "pullRequestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LayerSnapshot_layerId_headSha_key" ON "LayerSnapshot"("layerId", "headSha");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_githubRunId_key" ON "WorkflowRun"("githubRunId");

-- CreateIndex
CREATE INDEX "WorkflowRun_headSha_idx" ON "WorkflowRun"("headSha");

-- CreateIndex
CREATE INDEX "WorkflowRun_repositoryId_workflowPath_idx" ON "WorkflowRun"("repositoryId", "workflowPath");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_idempotencyKey_key" ON "Decision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Decision_repositoryId_createdAt_idx" ON "Decision"("repositoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsEvent_decisionId_key" ON "SavingsEvent"("decisionId");

-- CreateIndex
CREATE INDEX "SavingsEvent_repositoryId_createdAt_idx" ON "SavingsEvent"("repositoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationAccess" ADD CONSTRAINT "InstallationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationAccess" ADD CONSTRAINT "InstallationAccess_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stack" ADD CONSTRAINT "Stack_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackLayer" ADD CONSTRAINT "StackLayer_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "Stack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LayerSnapshot" ADD CONSTRAINT "LayerSnapshot_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "StackLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "StackLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "StackLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEvent" ADD CONSTRAINT "SavingsEvent_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEvent" ADD CONSTRAINT "SavingsEvent_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
