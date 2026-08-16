import useSWR from 'swr';
import { getNewsUnread } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type NewsUnread } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';

/**
 * The customer's unread-news counts, fetched once under the SHARED SWR key
 * `news-unread` so the nav badge (`AppLayout`) and the News page dedupe to a single
 * request and stay in lockstep. The News page clears the badge by `mutate('news-unread')`
 * after marking posts seen.
 *
 * Revalidates on focus (a new post can arrive while the tab is backgrounded). A 401
 * routes to the app-wide expired screen; any other error fails soft to zeroed defaults
 * (like `useStore`), so the badge simply hides rather than breaking the header.
 */
export function useNewsUnread(): NewsUnread {
  const onExpired = useOnExpired();
  const { data } = useSWR('news-unread', getNewsUnread, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    onError: (err) => {
      if (err instanceof ApiError && err.kind === ApiErrorKind.Unauthorized) {
        onExpired();
      }
    },
  });
  return { total: data?.total ?? 0, byStore: data?.byStore ?? [] };
}
