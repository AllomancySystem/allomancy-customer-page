import { useCallback, useState } from 'react';
import { getRedeliverableProducts, requestRedelivery } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import { ListControls } from '../components/ListControls.tsx';
import { ProductCard, type RedeliveryStatus } from '../components/ProductCard.tsx';
import { ProductSkeleton } from '../components/ProductSkeleton.tsx';
import { StatusScreen } from '../components/StatusScreen.tsx';
import { StoreFilter } from '../components/StoreFilter.tsx';
import { describeApiError } from '../lib/format.ts';
import { useCursorList } from '../lib/useCursorList.ts';
import { useStore } from '../lib/useStore.ts';

/**
 * `/` — the customer's redeliverable products. The customer identity (avatar) and
 * the account balances now live in the global sticky header (shown on every tab),
 * so this page is just its products list with its own loading/empty/error states.
 */
export function RedeliveryPage() {
  const onExpired = useOnExpired();
  // Collective store filter, applied server-side via ?storeId=; null = all stores.
  const { stores, isCollective } = useStore();
  const [storeId, setStoreId] = useState<string | null>(null);
  const products = useCursorList(getRedeliverableProducts, onExpired, storeId);
  const { revalidate: revalidateProducts } = products;

  // Per-product redelivery status, keyed by product id (unchanged behavior).
  const [redeliveryStatuses, setRedeliveryStatuses] = useState<Record<string, RedeliveryStatus>>({});
  const setStatus = useCallback((productId: string, status: RedeliveryStatus) => {
    setRedeliveryStatuses((prev) => ({ ...prev, [productId]: status }));
  }, []);

  const handleRedelivery = useCallback(
    async (productId: string) => {
      setStatus(productId, { state: 'pending' });
      try {
        await requestRedelivery(productId);
        setStatus(productId, { state: 'success' });
        // Revalidate from the server (the products list itself is unchanged — harmless).
        revalidateProducts();
      } catch (error) {
        if (error instanceof ApiError && error.kind === ApiErrorKind.Unauthorized) {
          onExpired();
          return;
        }
        const message =
          error instanceof ApiError
            ? describeApiError(error)
            : 'Could not request a redelivery. Please try again.';
        setStatus(productId, { state: 'error', message });
      }
    },
    [onExpired, setStatus, revalidateProducts],
  );

  return (
    <section aria-labelledby="products-heading" className="flex flex-col gap-4">
      {/* scroll-mt offsets the heading from under the sticky header for any anchor jump. */}
      <h1 id="products-heading" className="scroll-mt-36 text-2xl font-semibold tracking-tight">
        Redeliverable products
      </h1>

      {isCollective && <StoreFilter stores={stores} value={storeId} onChange={setStoreId} />}

      {!products.firstLoaded && products.loading && <ProductSkeleton />}

      {!products.firstLoaded && products.error && (
        <StatusScreen
          title="We couldn't load your products"
          tone="error"
          action={{ label: 'Try again', onClick: products.retry }}
        >
          <p>{describeApiError(products.error)}</p>
        </StatusScreen>
      )}

      {products.firstLoaded && products.items.length === 0 && (
        <StatusScreen title="No redeliverable products">
          <p>You don't have any products available for redelivery right now.</p>
        </StatusScreen>
      )}

      {products.items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] sm:gap-4">
          {products.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              status={redeliveryStatuses[product.id] ?? { state: 'idle' }}
              onRequest={handleRedelivery}
            />
          ))}
        </ul>
      )}

      {products.firstLoaded && (
        <ListControls
          error={products.error}
          nextCursor={products.nextCursor}
          loading={products.loading}
          onRetry={products.retry}
          onLoadMore={products.loadMore}
        />
      )}
    </section>
  );
}
