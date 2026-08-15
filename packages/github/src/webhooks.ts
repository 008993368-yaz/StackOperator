import { verify } from "@octokit/webhooks-methods";

export class UnsignedWebhookError extends Error {
  constructor() {
    super("Missing X-Hub-Signature-256");
    this.name = "UnsignedWebhookError";
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super("Invalid webhook signature");
    this.name = "InvalidWebhookSignatureError";
  }
}

export async function verifyGitHubSignature(input: {
  secret: string;
  rawBody: string;
  signature256: string | null;
}): Promise<void> {
  if (!input.signature256) {
    throw new UnsignedWebhookError();
  }
  const ok = await verify(input.secret, input.rawBody, input.signature256);
  if (!ok) {
    throw new InvalidWebhookSignatureError();
  }
}
