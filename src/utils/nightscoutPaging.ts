export type CursorType = 'number' | 'iso';
export type V3FilterStyle = 'filter' | 'dollar';

type DebugLog = ((...args: unknown[]) => void) | undefined;

type FetchPage = (path: string) => Promise<unknown[]>;

type FetchRaw = (path: string) => Promise<unknown>;

type GetCursorFromItem<T> = (item: T) => number | string | null;

type DedupeKeyFn<T> = (item: T) => string;

type UnwrapPage<T> = (raw: unknown) => T[];

export type PagedFetchV1Shared<T> = {
  pageSize: number;
  maxPages: number;

  startCursor?: number | string | null;
  endCursor: number | string;

  sortField?: string;
  targetCount?: number;
  getPageSize?: (pageIndex: number, collectedCount: number) => number;

  getCursorFromItem: GetCursorFromItem<T>;
  stopWhen?: (nextCursor: number | string | null) => boolean;
  dedupeKey?: DedupeKeyFn<T>;

  debugLabel?: string;
  debugLog?: DebugLog;
};

export type PagedFetchV1Request = {
  path: string;
  cursorField: string;
  cursorType: CursorType;
};

export function createPagedFetchV1<T = unknown>(
  fetchPage: FetchPage,
  shared: PagedFetchV1Shared<T>
) {
  return async (req: PagedFetchV1Request): Promise<T[]> => {
    return await pagedFetchV1Impl(fetchPage, {
      ...shared,
      ...req
    });
  };
}

export type PagedFetchV3Shared<T> = {
  cursorField: string;
  cursorType: CursorType;

  startCursor: number | string;
  endCursor: number | string;

  limit: number;
  maxPages: number;

  unwrapPage: UnwrapPage<T>;
  getCursorFromItem: GetCursorFromItem<T>;
  stopWhen?: (nextCursor: number | string | null) => boolean;
  dedupeKey?: DedupeKeyFn<T>;

  encodeDollarStyleValues?: boolean;

  debugLabel?: string;
  debugLog?: DebugLog;
};

export type PagedFetchV3Request = {
  endpoint: string;
  filterStyle: V3FilterStyle;
};

export function createPagedFetchV3<T = unknown>(
  fetchRaw: FetchRaw,
  shared: PagedFetchV3Shared<T>
) {
  return async (req: PagedFetchV3Request): Promise<T[]> => {
    return await pagedFetchV3Impl(fetchRaw, {
      ...shared,
      ...req
    });
  };
}

async function pagedFetchV1Impl<T = unknown>(
  fetchPage: FetchPage,
  options: {
    path: string;
    cursorField: string;
    cursorType: CursorType;

    pageSize: number;
    maxPages: number;

    startCursor?: number | string | null;
    endCursor: number | string;

    sortField?: string;
    targetCount?: number;

    getPageSize?: (pageIndex: number, collectedCount: number) => number;
    getCursorFromItem: GetCursorFromItem<T>;
    stopWhen?: (nextCursor: number | string | null) => boolean;

    dedupeKey?: DedupeKeyFn<T>;
    debugLabel?: string;
    debugLog?: DebugLog;
  }
): Promise<T[]> {
  const {
    path,
    cursorField,
    cursorType,
    pageSize,
    maxPages,
    startCursor,
    endCursor,
    sortField,
    targetCount,
    getPageSize,
    getCursorFromItem,
    stopWhen,
    dedupeKey,
    debugLabel,
    debugLog
  } = options;

  const collected: T[] = [];
  const seen = dedupeKey ? new Set<string>() : null;

  let cursor: number | string | null = endCursor;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    if (targetCount != null && collected.length >= targetCount) break;

    const requested = getPageSize ? getPageSize(pageIndex, collected.length) : pageSize;
    const effectivePageSize = Math.max(1, requested);

    const params = new URLSearchParams();
    params.set('count', String(effectivePageSize));
    params.set('sort$desc', String(sortField ?? cursorField));

    if (startCursor != null) {
      params.set(`find[${cursorField}][$gte]`, String(startCursor));
    }

    params.set(
      `find[${cursorField}][${pageIndex === 0 ? '$lte' : '$lt'}]`,
      cursorType === 'number' ? String(cursor ?? endCursor) : String(cursor ?? endCursor)
    );

    const fullPath = `${path}?${params.toString()}`;
    debugLog?.(`📄 ${debugLabel ?? 'API v1'} page ${pageIndex + 1}/${maxPages}: ${fullPath}`);

    const page = (await fetchPage(fullPath)) as T[];
    if (!page.length) break;

    for (const item of page) {
      if (!seen || !dedupeKey) {
        collected.push(item);
        continue;
      }
      const key = dedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(item);
    }

    const oldest = page[page.length - 1];
    const nextCursor = getCursorFromItem(oldest);
    if (!nextCursor) break;
    if (stopWhen?.(nextCursor)) break;
    cursor = nextCursor;

    if (page.length < effectivePageSize) break;
  }

  return collected;
}

async function pagedFetchV3Impl<T = unknown>(
  fetchRaw: FetchRaw,
  options: {
    endpoint: string;
    filterStyle: V3FilterStyle;

    cursorField: string;
    cursorType: CursorType;

    startCursor: number | string;
    endCursor: number | string;

    limit: number;
    maxPages: number;

    unwrapPage: UnwrapPage<T>;
    getCursorFromItem: GetCursorFromItem<T>;
    stopWhen?: (nextCursor: number | string | null) => boolean;

    dedupeKey?: DedupeKeyFn<T>;

    // Some deployments expect pre-encoded ISO values in the $-style filters.
    encodeDollarStyleValues?: boolean;

    debugLabel?: string;
    debugLog?: DebugLog;
  }
): Promise<T[]> {
  const {
    endpoint,
    filterStyle,
    cursorField,
    cursorType,
    startCursor,
    endCursor,
    limit,
    maxPages,
    unwrapPage,
    getCursorFromItem,
    stopWhen,
    dedupeKey,
    encodeDollarStyleValues,
    debugLabel,
    debugLog
  } = options;

  const collected: T[] = [];
  const seen = dedupeKey ? new Set<string>() : null;

  let cursor: number | string | null = endCursor;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));

    if (filterStyle === 'filter') {
      params.set(`filter[${cursorField}][$gte]`, String(startCursor));
      params.set(
        `filter[${cursorField}][${pageIndex === 0 ? '$lte' : '$lt'}]`,
        String(cursor ?? endCursor)
      );
      params.set('sort', `-${cursorField}`);
    } else {
      const maybeEncode = (value: string) => (encodeDollarStyleValues ? encodeURIComponent(value) : value);

      const startValue =
        cursorType === 'iso' ? maybeEncode(String(startCursor)) : String(startCursor);
      const cursorValue =
        cursorType === 'iso' ? maybeEncode(String(cursor ?? endCursor)) : String(cursor ?? endCursor);

      params.set(`${cursorField}$gte`, startValue);
      params.set(`${cursorField}${pageIndex === 0 ? '$lte' : '$lt'}`, cursorValue);
      params.set('sort$desc', cursorField);
    }

    const path = `${endpoint}?${params.toString()}`;
    debugLog?.(`📄 ${debugLabel ?? 'API v3'} page ${pageIndex + 1}/${maxPages} (${filterStyle}): ${path}`);

    const raw = await fetchRaw(path);
    const page = unwrapPage(raw);
    if (!page.length) break;

    for (const item of page) {
      if (!seen || !dedupeKey) {
        collected.push(item);
        continue;
      }
      const key = dedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(item);
    }

    const oldest = page[page.length - 1];
    const nextCursor = getCursorFromItem(oldest);
    if (!nextCursor) break;
    if (stopWhen?.(nextCursor)) break;
    cursor = nextCursor;

    if (page.length < limit) break;
  }

  return collected;
}
