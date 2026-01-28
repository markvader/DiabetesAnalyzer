import { toEpochMs, toEpochNumber } from './time';
import { createPagedFetchV1 } from './nightscoutPaging';

export type NightscoutV1PagingConfig = {
  startTimestamp: number;
  endTimestamp: number;
  startDateIso: string;
  endDateIso: string;

  // entries
  entriesTarget: number;
  maxV1EntryPageSize?: number;

  // treatments
  treatmentsPageSize?: number;
  treatmentsMaxPages?: number;

  debugLog?: (...args: unknown[]) => void;
};

type FetchPage = (path: string) => Promise<unknown[]>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const getV1EntryDateMs = (entry: unknown): number | null => {
  if (!isRecord(entry)) return null;
  const candidate = entry.date ?? entry.mills ?? entry.srvCreated ?? entry.dateString ?? entry.created_at;
  return toEpochMs(candidate);
};

const getV1TreatmentTimeMs = (treatment: unknown): number | null => {
  if (!isRecord(treatment)) return null;
  const candidate = treatment.created_at ?? treatment.timestamp ?? treatment.mills;
  return toEpochMs(candidate);
};

export const fetchNightscoutV1EntriesPaged = async (
  fetchPage: FetchPage,
  config: NightscoutV1PagingConfig
): Promise<unknown[]> => {
  const maxV1EntryPageSize = config.maxV1EntryPageSize ?? 10000;
  const target = Math.min(Math.max(0, config.entriesTarget), 30000);

  const maxPages = Math.max(1, Math.ceil(target / maxV1EntryPageSize));

  const pagedFetchV1 = createPagedFetchV1(fetchPage, {
    pageSize: maxV1EntryPageSize,
    maxPages,
    startCursor: config.startTimestamp,
    endCursor: config.endTimestamp,
    sortField: 'date',
    targetCount: target,
    getPageSize: (_pageIndex, collectedCount) => {
      const remaining = target - collectedCount;
      return Math.min(maxV1EntryPageSize, remaining);
    },
    getCursorFromItem: (item) => getV1EntryDateMs(item),
    stopWhen: (nextCursor) => typeof nextCursor === 'number' && nextCursor <= config.startTimestamp,
    dedupeKey: (item) => {
      const record = isRecord(item) ? item : null;
      const id = record?._id ?? record?.id ?? getV1EntryDateMs(item);
      return `${id ?? ''}:${record?.type ?? ''}:${record?.sgv ?? ''}`;
    },
    debugLabel: 'API v1 entries',
    debugLog: config.debugLog
  });

  return await pagedFetchV1({ path: '/api/v1/entries', cursorField: 'date', cursorType: 'number' });
};

export const fetchNightscoutV1TreatmentsPaged = async (
  fetchPage: FetchPage,
  config: NightscoutV1PagingConfig
): Promise<unknown[]> => {
  const pageSize = config.treatmentsPageSize ?? 5000;
  const maxPages = config.treatmentsMaxPages ?? 25;

  config.debugLog?.(`📄 API v1 treatments pagination enabled (max ${maxPages} pages × ${pageSize})`);

  const fetchCreatedAtPages = async () => {
    const pagedFetchV1 = createPagedFetchV1(fetchPage, {
      pageSize,
      maxPages,
      endCursor: config.endDateIso,
      sortField: 'created_at',
      getCursorFromItem: (item) => {
        const oldestMs = getV1TreatmentTimeMs(item);
        return oldestMs ? new Date(oldestMs).toISOString() : null;
      },
      stopWhen: (nextCursor) => {
        const ms = Date.parse(String(nextCursor ?? ''));
        return Number.isFinite(ms) && ms <= config.startTimestamp;
      },
      debugLabel: 'API v1 treatments(created_at)',
      debugLog: config.debugLog
    });

    return await pagedFetchV1({ path: '/api/v1/treatments', cursorField: 'created_at', cursorType: 'iso' });
  };

  const fetchTimestampPages = async () => {
    let lastOldestMs: number | null = null;

    const pagedFetchV1 = createPagedFetchV1(fetchPage, {
      pageSize,
      maxPages,
      endCursor: config.endTimestamp,
      sortField: 'timestamp',
      getCursorFromItem: (item) => {
        lastOldestMs = getV1TreatmentTimeMs(item);
        if (!lastOldestMs) return null;
        const record = isRecord(item) ? item : null;
        const oldestRaw = record ? toEpochNumber(record.timestamp ?? record.mills) : null;
        return oldestRaw ?? null;
      },
      stopWhen: () => {
        return !!(lastOldestMs && lastOldestMs <= config.startTimestamp);
      },
      debugLabel: 'API v1 treatments(timestamp)',
      debugLog: config.debugLog
    });

    return await pagedFetchV1({ path: '/api/v1/treatments', cursorField: 'timestamp', cursorType: 'number' });
  };

  const byCreatedAt = await fetchCreatedAtPages();
  // Most Nightscout instances include `created_at`. Only fall back to timestamp paging
  // when `created_at` is missing/unusable.
  const byTimestamp = byCreatedAt.length > 0 ? [] : await fetchTimestampPages();

  const combined = [...byCreatedAt, ...byTimestamp];
  const seen = new Set<string>();

  const deduped = combined.filter((t: unknown) => {
    const record = isRecord(t) ? t : null;
    const id = record?._id ?? record?.id;
    const key = id ? String(id) : `${record?.eventType ?? ''}:${record?.created_at ?? ''}:${record?.timestamp ?? ''}:${record?.enteredBy ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const inRange = deduped.filter((t: unknown) => {
    const tMs = getV1TreatmentTimeMs(t);
    if (!tMs) return false;
    return tMs >= config.startTimestamp && tMs <= config.endTimestamp;
  });

  config.debugLog?.(`📄 API v1 treatments collected: ${combined.length}, deduped: ${deduped.length}, in-range: ${inRange.length}`);
  return inRange;
};
