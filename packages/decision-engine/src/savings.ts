import {
  elapsedMinutes,
  estimatedCostUsd,
  estimatedMinutesAvoided,
  LINUX_2CORE_SKU,
} from "@stackoperator/shared";
import type { RepoRules } from "@stackoperator/config";
import { matchingWorkflowRules } from "./eligibility.js";
import type { WorkflowState } from "./types.js";

export type SavingsEstimate = {
  minutesEstimated: number;
  costEstimatedUsd: number;
  pricingSku: typeof LINUX_2CORE_SKU;
  isEstimate: true;
};

export function estimateAvoided(input: {
  rules: RepoRules | null;
  workflow: WorkflowState;
  historicalAverageMinutes: number | null;
  defaultEstimatedMinutes: number;
  usdPerMinute: number;
  startedAt: Date | null;
  endedAt: Date;
}): SavingsEstimate {
  const matched = matchingWorkflowRules(input.rules, input.workflow);
  const fromConfig = matched.find((entry) => entry.estimatedMinutes !== null)?.estimatedMinutes;
  const estimatedDuration =
    fromConfig ?? input.historicalAverageMinutes ?? input.defaultEstimatedMinutes;
  const elapsed = elapsedMinutes(input.startedAt, input.endedAt);
  const minutes = estimatedMinutesAvoided(estimatedDuration, elapsed);
  return {
    minutesEstimated: minutes,
    costEstimatedUsd: estimatedCostUsd(minutes, input.usdPerMinute),
    pricingSku: LINUX_2CORE_SKU,
    isEstimate: true,
  };
}
