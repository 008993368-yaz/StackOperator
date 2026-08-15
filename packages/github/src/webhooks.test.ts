import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InvalidWebhookSignatureError, UnsignedWebhookError, verifyGitHubSignature } from "./webhooks.js";

function sign(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

describe("verifyGitHubSignature", () => {
  const secret = "top-secret";
  const body = '{"zen":"Keep it logically awesome."}';

  it("accepts a valid signature", async () => {
    await expect(
      verifyGitHubSignature({ secret, rawBody: body, signature256: sign(secret, body) }),
    ).resolves.toBeUndefined();
  });

  it("rejects unsigned payloads", async () => {
    await expect(
      verifyGitHubSignature({ secret, rawBody: body, signature256: null }),
    ).rejects.toBeInstanceOf(UnsignedWebhookError);
  });

  it("rejects invalid signatures", async () => {
    await expect(
      verifyGitHubSignature({
        secret,
        rawBody: body,
        signature256: "sha256=deadbeef",
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
  });
});
