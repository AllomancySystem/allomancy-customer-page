import useSWR from 'swr';
import { getStoreContext } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type Brand, type StoreRef } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';

interface StoreContextResult {
  /** The brand for the header (undefined while loading or on error). */
  brand: Brand | undefined;
  /** All stores the customer's items span (a single entry today). */
  stores: StoreRef[];
  /** O(1) store lookup by id, for per-item resolution (e.g. a gift card's storeId). */
  storesById: Record<string, StoreRef>;
  /** True when the customer's items span more than one store (a collective). */
  isCollective: boolean;
  loading: boolean;
}

/**
 * The customer's store context (brand + stores), fetched once and shared. SWR dedupes
 * the shared key, so calling this from several components triggers a single request.
 * The context rarely changes, so focus revalidation is off. On a 401 it routes to the
 * app-wide expired screen; any other error fails soft (callers show a neutral state).
 */
export function useStore(): StoreContextResult {
  const onExpired = useOnExpired();
  const { data, isLoading } = useSWR('customer-context', getStoreContext, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: (err) => {
      if (err instanceof ApiError && err.kind === ApiErrorKind.Unauthorized) {
        onExpired();
      }
    },
  });
  const stores = data?.stores ?? [];
  const storesById: Record<string, StoreRef> = Object.fromEntries(
    stores.map((s) => [s.id, s]),
  );
  return {
    brand: data?.brand,
    stores,
    storesById,
    isCollective: stores.length > 1,
    loading: isLoading,
  };
}
