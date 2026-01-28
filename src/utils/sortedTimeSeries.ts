export const lowerBoundByMs = <T>(items: readonly T[], getMs: (item: T) => number, cutoffMs: number): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (getMs(items[mid]) < cutoffMs) low = mid + 1;
    else high = mid;
  }
  return low;
};

export const upperBoundByMs = <T>(items: readonly T[], getMs: (item: T) => number, cutoffMs: number): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (getMs(items[mid]) <= cutoffMs) low = mid + 1;
    else high = mid;
  }
  return low;
};

export const sliceSortedByTimeRange = <T>(
  items: readonly T[],
  getMs: (item: T) => number,
  startMs: number,
  endMs: number
): T[] => {
  if (items.length === 0) return [];
  const startIndex = lowerBoundByMs(items, getMs, startMs);
  const endIndex = upperBoundByMs(items, getMs, endMs);
  return items.slice(startIndex, endIndex);
};
