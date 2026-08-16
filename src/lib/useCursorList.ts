import { useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { DEFAULT_PAGE_LIMIT } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type CursorEnvelope } from '../api/types.ts';

type FetchPage<T> = (
  limit: number,
  cursor: string | null,
  storeId: string | null,
) => Promise<CursorEnvelope<T>>;

// Per-page SWR key: a discriminator + the fetcher (unique per list) + that page's
// cursor + the store filter. Changing the filter re-keys the list back to page 1.
type PageKey<T> = readonly ['cursor-list', FetchPage<T>, string | null, string | null];

export interface CursorList<T> {
  items: T[];
  /** A request is in flight (initial load, load-more, or a focus/post-mutation revalidation). */
  loading: boolean;
  /** True once the first page has resolved (so we can tell "loading" from "empty"). */
  firstLoaded: boolean;
  error: ApiError | null;
  nextCursor: string | null;
  loadMore: () => void;
  /** Retry the loaded pages after a failure. */
  retry: () => void;
  /** Revalidate the loaded pages from the server — the source of truth after a mutation. */
  revalidate: () => void;
}

/**
 * Cursor-paginated "load more" list built on `useSWRInfinite`.
 *
 * - Refetch-on-focus: `revalidateOnFocus` re-pulls the loaded data when the tab
 *   regains focus, so the list is always fresh.
 * - `revalidate()` re-pulls from the server after a mutation (redeem/transfer/
 *   redelivery) — replacing manual optimistic edits; the server is authoritative.
 * - `storeId` is an optional server-side filter (collective lists). It rides in the
 *   SWR key AND is passed to `fetchPage`, so changing it re-fetches from page 1 and
 *   the backend applies the filter (correct with cursor pagination). Default null =
 *   all stores; single-store pages just leave it null.
 * - A 401 is thrown by the fetcher (the frozen `request()` clears the token); the
 *   `onError` callback routes it to the app-wide expired screen via `onExpired()`,
 *   and it is never surfaced as an inline list error.
 */
export function useCursorList<T>(
  fetchPage: FetchPage<T>,
  onExpired: () => void,
  storeId: string | null = null,
): CursorList<T> {
  const { data, error, isValidating, setSize, mutate } = useSWRInfinite<CursorEnvelope<T>, ApiError>(
    (pageIndex, previousPageData: CursorEnvelope<T> | null): PageKey<T> | null => {
      // Stop once the previous page reported no further cursor.
      if (previousPageData && previousPageData.pagination.nextCursor === null) {
        return null;
      }
      const cursor = pageIndex === 0 ? null : (previousPageData?.pagination.nextCursor ?? null);
      return ['cursor-list', fetchPage, cursor, storeId];
    },
    (key: PageKey<T>) => key[1](DEFAULT_PAGE_LIMIT, key[2], key[3]),
    {
      revalidateOnFocus: true,
      // Refresh every loaded page on focus/revalidation so the whole list is fresh
      // (important after a mutation changes membership, e.g. a redeemed card).
      revalidateAll: true,
      // No silent auto-retry loop — failures are user-driven ("Try again"), matching
      // the previous behavior and avoiding a skeleton/error flicker.
      shouldRetryOnError: false,
      onError: (err) => {
        if (err instanceof ApiError && err.kind === ApiErrorKind.Unauthorized) {
          onExpired();
        }
      },
    },
  );

  const items = data ? data.flatMap((page) => page.data) : [];
  const firstLoaded = data !== undefined;
  const lastPage = data && data.length > 0 ? data[data.length - 1] : undefined;
  const nextCursor = lastPage ? lastPage.pagination.nextCursor : null;

  // A 401 drives the app-wide expired screen (onExpired) — never an inline error.
  const surfacedError =
    error instanceof ApiError && error.kind !== ApiErrorKind.Unauthorized ? error : null;

  const loadMore = useCallback(() => void setSize((s) => s + 1), [setSize]);
  const retry = useCallback(() => void mutate(), [mutate]);
  const revalidate = useCallback(() => void mutate(), [mutate]);

  return {
    items,
    loading: isValidating,
    firstLoaded,
    error: surfacedError,
    nextCursor,
    loadMore,
    retry,
    revalidate,
  };
}
