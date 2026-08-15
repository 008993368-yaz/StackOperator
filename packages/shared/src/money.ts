export const LINUX_2CORE_SKU = "github_linux_2_core";

export function estimatedCostUsd(minutes: number, usdPerMinute: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }
  if (!Number.isFinite(usdPerMinute) || usdPerMinute < 0) {
    return 0;
  }
  return roundMoney(minutes * usdPerMinute);
}

export function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function estimatedMinutesAvoided(
  estimatedDurationMinutes: number,
  elapsedMinutes: number,
): number {
  return Math.max(0, estimatedDurationMinutes - Math.max(0, elapsedMinutes));
}

export function elapsedMinutes(startedAt: Date | null, endedAt: Date): number {
  if (!startedAt) {
    return 0;
  }
  const ms = endedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return 0;
  }
  return ms / 60_000;
}
