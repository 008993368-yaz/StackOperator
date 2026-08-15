export type LayerLike = {
  position: number;
  pullRequestNumber: number;
};

export function sortLayers<T extends LayerLike>(layers: readonly T[]): T[] {
  return [...layers].sort((a, b) => a.position - b.position);
}

export function parentPullRequestNumber(
  layers: readonly LayerLike[],
  pullRequestNumber: number,
): number | null {
  const ordered = sortLayers(layers);
  const index = ordered.findIndex((layer) => layer.pullRequestNumber === pullRequestNumber);
  if (index <= 0) {
    return null;
  }
  return ordered[index - 1]?.pullRequestNumber ?? null;
}

export function descendantLayers<T extends LayerLike>(
  layers: readonly T[],
  pullRequestNumber: number,
): T[] {
  const ordered = sortLayers(layers);
  const index = ordered.findIndex((layer) => layer.pullRequestNumber === pullRequestNumber);
  if (index < 0) {
    return [];
  }
  return ordered.slice(index + 1);
}

export function ancestorLayers<T extends LayerLike>(
  layers: readonly T[],
  pullRequestNumber: number,
): T[] {
  const ordered = sortLayers(layers);
  const index = ordered.findIndex((layer) => layer.pullRequestNumber === pullRequestNumber);
  if (index <= 0) {
    return [];
  }
  return ordered.slice(0, index);
}

export function findLayer<T extends LayerLike>(
  layers: readonly T[],
  pullRequestNumber: number,
): T | undefined {
  return layers.find((layer) => layer.pullRequestNumber === pullRequestNumber);
}
