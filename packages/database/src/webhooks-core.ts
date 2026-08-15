export type DeliveryStatus = "received" | "processed" | "failed";

export type PersistDeliveryInput = {
  githubDeliveryId: string;
  event: string;
  action: string | null;
  installationId: string | null;
  repositoryFullName: string | null;
  pullRequestNumber: number | null;
};

export type PersistDeliveryResult =
  | { kind: "inserted"; id: string }
  | { kind: "duplicate"; id: string; status: string };

export type DeliveryStore = {
  findByGithubDeliveryId(
    githubDeliveryId: string,
  ): Promise<{ id: string; status: string } | null>;
  create(input: PersistDeliveryInput): Promise<{ id: string }>;
};

export async function persistWebhookDeliveryWith(
  store: DeliveryStore,
  input: PersistDeliveryInput,
): Promise<PersistDeliveryResult> {
  const existing = await store.findByGithubDeliveryId(input.githubDeliveryId);
  if (existing) {
    return { kind: "duplicate", id: existing.id, status: existing.status };
  }

  try {
    const created = await store.create(input);
    return { kind: "inserted", id: created.id };
  } catch {
    const again = await store.findByGithubDeliveryId(input.githubDeliveryId);
    if (again) {
      return { kind: "duplicate", id: again.id, status: again.status };
    }
    throw new Error("Failed to persist webhook delivery");
  }
}
