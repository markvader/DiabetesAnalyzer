export const toEpochMs = (value: unknown): number | null => {
  if (value == null) return null;

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // Heuristic: epoch seconds are ~1e9, epoch ms are ~1e12.
    // Treat anything < 1e11 as seconds.
    return value < 1e11 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return toEpochMs(asNumber);
    }

    const asDate = Date.parse(trimmed);
    return Number.isFinite(asDate) ? asDate : null;
  }

  return null;
};

export const toEpochNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  return null;
};
