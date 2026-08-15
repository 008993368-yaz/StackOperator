import { z } from "zod";

const accountSchema = z.object({
  id: z.number(),
  login: z.string(),
  type: z.string().optional(),
});

const installationSchema = z.object({
  id: z.number(),
  account: accountSchema.optional(),
  suspended_at: z.string().nullable().optional(),
});

const repositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string() }),
  default_branch: z.string().optional(),
});

const pullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  head: z.object({
    sha: z.string(),
    ref: z.string(),
  }),
  base: z.object({
    sha: z.string(),
    ref: z.string(),
  }),
});

const workflowRunSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  event: z.string(),
  status: z.string(),
  conclusion: z.string().nullable().optional(),
  head_sha: z.string(),
  head_branch: z.string().nullable().optional(),
  html_url: z.string().optional(),
  run_started_at: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  path: z.string().nullable().optional(),
  workflow_id: z.number().optional(),
});

export const webhookEnvelopeSchema = z.object({
  action: z.string().optional(),
  installation: installationSchema.optional(),
  repository: repositorySchema.optional(),
  sender: z.object({ id: z.number(), login: z.string() }).optional(),
  pull_request: pullRequestSchema.optional(),
  workflow_run: workflowRunSchema.optional(),
  repositories: z.array(repositorySchema).optional(),
  repositories_added: z.array(repositorySchema).optional(),
  repositories_removed: z.array(z.object({ id: z.number(), full_name: z.string() })).optional(),
});

export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;

export function parseWebhookPayload(rawBody: string): WebhookEnvelope {
  const json: unknown = JSON.parse(rawBody);
  return webhookEnvelopeSchema.parse(json);
}

export function webhookMeta(event: string, payload: WebhookEnvelope): {
  action: string | null;
  installationGithubId: string | null;
  repositoryFullName: string | null;
  pullRequestNumber: number | null;
} {
  return {
    action: payload.action ?? (event === "ping" ? "ping" : null),
    installationGithubId: payload.installation ? String(payload.installation.id) : null,
    repositoryFullName: payload.repository?.full_name ?? null,
    pullRequestNumber: payload.pull_request?.number ?? null,
  };
}
