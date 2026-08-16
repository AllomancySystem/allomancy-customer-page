import { useState } from 'react';
import { getGiftCards } from '../api/customerClient.ts';
import { useOnExpired } from '../app/expired.ts';
import { GiftCardCard } from '../components/GiftCardCard.tsx';
import { ListControls } from '../components/ListControls.tsx';
import { ProductSkeleton } from '../components/ProductSkeleton.tsx';
import { StatusScreen } from '../components/StatusScreen.tsx';
import { StoreFilter } from '../components/StoreFilter.tsx';
import { describeApiError } from '../lib/format.ts';
import { useCursorList } from '../lib/useCursorList.ts';
import { useStore } from '../lib/useStore.ts';

/** `/giftcards` — every gift card the customer holds, with redeem/transfer actions. */
export function GiftCardsPage() {
  const onExpired = useOnExpired();
  // Collective store filter, applied server-side via ?storeId=; null = all stores.
  const { stores, isCollective } = useStore();
  const [storeId, setStoreId] = useState<string | null>(null);
  const list = useCursorList(getGiftCards, onExpired, storeId);

  // Show only active, not-yet-used cards. The server already hides expired-unredeemed
  // cards; the remaining states (active/inactive/redeemed) all come through, so we still
  // filter `active && !redeemed` here for display.
  const visibleCards = list.items.filter((c) => c.active && !c.redeemed);

  if (!list.firstLoaded && list.loading) {
    return <ProductSkeleton />;
  }

  if (!list.firstLoaded && list.error) {
    return (
      <StatusScreen
        title="We couldn't load your gift cards"
        tone="error"
        action={{ label: 'Try again', onClick: list.retry }}
      >
        <p>{describeApiError(list.error)}</p>
      </StatusScreen>
    );
  }

  return (
    <section aria-labelledby="giftcards-heading" className="flex flex-col gap-4">
      <h1 id="giftcards-heading" className="scroll-mt-36 text-2xl font-semibold tracking-tight">
        Gift cards
      </h1>

      {isCollective && <StoreFilter stores={stores} value={storeId} onChange={setStoreId} />}

      {list.firstLoaded && visibleCards.length === 0 ? (
        <StatusScreen title="No gift cards">
          <p>Gift cards you buy or receive will appear here.</p>
        </StatusScreen>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] sm:gap-4">
          {visibleCards.map((card) => (
            // After a redeem/transfer, revalidate from the server (source of truth):
            // a redeemed card returns redeemed → filtered out; a transferred card is gone.
            <GiftCardCard key={card.id} card={card} onChanged={list.revalidate} />
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
