import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { getNews, getProfile, markNewsSeen } from '../api/customerClient.ts';
import { useOnExpired } from '../app/expired.ts';
import { ListControls } from '../components/ListControls.tsx';
import { ListSkeleton } from '../components/ListSkeleton.tsx';
import { NewsCard } from '../components/NewsCard.tsx';
import { StatusScreen } from '../components/StatusScreen.tsx';
import { StoreFilter } from '../components/StoreFilter.tsx';
import { describeApiError } from '../lib/format.ts';
import { useCursorList } from '../lib/useCursorList.ts';
import { useNewsUnread } from '../lib/useNewsUnread.ts';
import { useStore } from '../lib/useStore.ts';

/** `/news` — the customer's News Kiosk feed (cursor-paginated), with on-demand item requests. */
export function NewsPage() {
  const onExpired = useOnExpired();
  // Collective store filter, applied server-side via ?storeId=; null = all stores.
  const { stores, isCollective } = useStore();
  const [storeId, setStoreId] = useState<string | null>(null);
  const list = useCursorList(getNews, onExpired, storeId);

  // The viewer, for `{username}`/`{name}` substitution. Shares CustomerAvatar's SWR key
  // so the header avatar and this page issue a single profile request.
  const { data: profile } = useSWR('customer-profile', getProfile, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const username = profile?.username ?? 'resident';

  // Per-store unread counts for the collective filter pills (keyed by storeId).
  const unread = useNewsUnread();
  const unreadByStore: Record<string, number> = Object.fromEntries(
    unread.byStore.map((entry) => [entry.storeId, entry.count]),
  );

  // Clear the unread badge whenever there is unread news while this page is open. The
  // badge (useNewsUnread) and the feed both revalidate on focus, so a post that arrives
  // while the tab is backgrounded raises unread.total on refocus and this marks it seen
  // without the customer leaving the page. Best effort: a failure leaves the badge, harmless.
  useEffect(() => {
    if (unread.total <= 0) return;
    void (async () => {
      try {
        await markNewsSeen();
        await mutate('news-unread');
      } catch {
        // Ignored: a lingering badge is harmless; never surface an error.
      }
    })();
  }, [unread.total]);

  if (!list.firstLoaded && list.loading) {
    return <ListSkeleton />;
  }

  if (!list.firstLoaded && list.error) {
    return (
      <StatusScreen
        title="We couldn't load your news"
        tone="error"
        action={{ label: 'Try again', onClick: list.retry }}
      >
        <p>{describeApiError(list.error)}</p>
      </StatusScreen>
    );
  }

  return (
    <section aria-labelledby="news-heading" className="flex flex-col gap-4">
      <h1 id="news-heading" className="scroll-mt-36 text-2xl font-semibold tracking-tight">
        News
      </h1>

      {isCollective && (
        <StoreFilter stores={stores} value={storeId} onChange={setStoreId} unreadByStore={unreadByStore} />
      )}

      {list.firstLoaded && list.items.length === 0 ? (
        <StatusScreen title="No news yet">
          <p>Updates from the store's News Kiosk will show up here.</p>
        </StatusScreen>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.items.map((post) => (
            <li key={post.id}>
              <NewsCard post={post} username={username} />
            </li>
          ))}
        </ul>
      )}

      <ListControls
        error={list.error}
        nextCursor={list.nextCursor}
        loading={list.loading}
        onRetry={list.retry}
        onLoadMore={list.loadMore}
      />
    </section>
  );
}
