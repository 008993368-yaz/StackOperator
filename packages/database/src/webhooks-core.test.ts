import { describe, expect, it } from "vitest";
import { persistWebhookDeliveryWith, type DeliveryStore } from "./webhooks-core.js";

function memoryStore(): DeliveryStore & { rows: Map<string, { id: string; status: string }> } {
  const rows = new Map<string, { id: string; status: string }>();
  return {
    rows,
    async findByGithubDeliveryId(githubDeliveryId) {
      return rows.get(githubDeliveryId) ?? null;
    },
    async create(input) {
      if (rows.has(input.githubDeliveryId)) {
        throw new Error("unique_violation");
      }
      const row = { id: `id-${rows.size + 1}`, status: "received" };
      rows.set(input.githubDeliveryId, row);
      return { id: row.id };
    },
  };
}

describe("persistWebhookDelivery", () => {
  const sample = {
    githubDeliveryId: "abc-123",
    event: "pull_request",
    action: "stacked",
    installationId: "inst-1",
    repositoryFullName: "octo/hello",
    pullRequestNumber: 12,
  };

  it("inserts a new delivery", async () => {
    const store = memoryStore();
    const result = await persistWebhookDeliveryWith(store, sample);
    expect(result).toEqual({ kind: "inserted", id: "id-1" });
  });

  it("no-ops duplicate deliveries", async () => {
    const store = memoryStore();
    await persistWebhookDeliveryWith(store, sample);
    const again = await persistWebhookDeliveryWith(store, sample);
    expect(again.kind).toBe("duplicate");
    expect(store.rows.size).toBe(1);
  });
});
