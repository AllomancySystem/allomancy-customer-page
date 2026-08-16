import { useState } from 'react';
import { getTransactions } from '../api/customerClient.ts';
import { useOnExpired } from '../app/expired.ts';
import { ListControls } from '../components/ListControls.tsx';
import { ListSkeleton } from '../components/ListSkeleton.tsx';
import { StatusScreen } from '../components/StatusScreen.tsx';
import { StoreFilter } from '../components/StoreFilter.tsx';
import { TransactionCard } from '../components/TransactionCard.tsx';
import { describeApiError } from '../lib/format.ts';
import { useCursorList } from '../lib/useCursorList.ts';
import { useStore } from '../lib/useStore.ts';

/** `/transactions` — the customer's in-world transaction history (cursor-paginated). */
export function TransactionsPage() {
  const onExpired = useOnExpired();
  // Collective store filter, applied server-side via ?storeId=; null = all stores.
  const { stores, isCollective } = useStore();
  const [storeId, setStoreId] = useState<string | null>(null);
  const list = useCursorList(getTransactions, onExpired, storeId);

  if (!list.firstLoaded && list.loading) {
    return <ListSkeleton />;
  }

  if (!list.firstLoaded && list.error) {
    return (
      <StatusScreen
        title="We couldn't load your transactions"
        tone="error"
        action={{ label: 'Try again', onClick: list.retry }}
      >
        <p>{describeApiError(list.error)}</p>
      </StatusScreen>
    );
  }

  return (
    <section aria-labelledby="transactions-heading" className="flex flex-col gap-4">
      <h1 id="transactions-heading" className="scroll-mt-36 text-2xl font-semibold tracking-tight">
        Transactions
      </h1>

      {isCollective && <StoreFilter stores={stores} value={storeId} onChange={setStoreId} />}

      {list.firstLoaded && list.items.length === 0 ? (
        <StatusScreen title="No transactions yet">
          <p>Your in-world purchases and deliveries will show up here.</p>
        </StatusScreen>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.items.map((tx) => (
            <li key={tx.id}>
              <TransactionCard tx={tx} />
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
