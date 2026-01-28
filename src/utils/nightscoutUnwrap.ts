type Guard = (value: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const looksLikeEntry: Guard = (value: unknown): boolean => {
  return isRecord(value) && (
    'sgv' in value ||
    'date' in value ||
    'mills' in value ||
    'srvCreated' in value ||
    'dateString' in value
  );
};

const looksLikeTreatment: Guard = (value: unknown): boolean => {
  return isRecord(value) && (
    'eventType' in value ||
    'created_at' in value ||
    'timestamp' in value ||
    'mills' in value
  );
};

const unwrapArray = (raw: unknown, keys: string[], itemGuard: Guard): unknown[] => {
  if (Array.isArray(raw)) return raw;

  if (isRecord(raw)) {
    for (const key of keys) {
      const maybe = raw[key];
      if (Array.isArray(maybe)) return maybe;
      if (maybe && itemGuard(maybe)) return [maybe];
    }

    const maybeData = raw.data;
    if (Array.isArray(maybeData)) return maybeData;
    if (maybeData && itemGuard(maybeData)) return [maybeData];

    // Some proxies return the item directly (non-array). Only accept if it looks like our expected shape.
    if (itemGuard(raw)) return [raw];
  }

  return [];
};

export const unwrapNightscoutV3Entries = (raw: unknown): unknown[] => {
  return unwrapArray(raw, ['entries', 'entry', 'result', 'items'], looksLikeEntry);
};

export const unwrapNightscoutV3Treatments = (raw: unknown): unknown[] => {
  return unwrapArray(raw, ['treatments', 'treatment', 'result', 'items'], looksLikeTreatment);
};

export const normalizeNightscoutV3ProfileArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    const maybe = raw.profile ?? raw.profiles ?? raw.data;
    if (Array.isArray(maybe)) return maybe;
    if (maybe) return [maybe];
  }
  return raw ? [raw] : [];
};

export const normalizeNightscoutV3DeviceStatusArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    const maybe = raw.deviceStatus ?? raw.devicestatus ?? raw.device_status ?? raw.data;
    if (Array.isArray(maybe)) return maybe;
    if (maybe) return [maybe];
  }
  return raw ? [raw] : [];
};
