export const JOB_PROCESS_WEBHOOK = "process-webhook";

export type WebhookJobPayload = {
  deliveryId: string;
  githubDeliveryId: string;
  event: string;
  action: string | null;
  installationGithubId: string | null;
  rawBody: string;
};
