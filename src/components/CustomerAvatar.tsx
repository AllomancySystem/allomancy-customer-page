import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import { getProfile } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import { SlAvatar } from './SlAvatar.tsx';

/**
 * Customer avatar for the top-right of the sticky header. The profile is fetched
 * ONCE here (SWR, refetch-on-focus) so the avatar shows on every tab. There's no
 * visible "welcome" text — vertical space is precious — so the username is the
 * avatar's accessible label (`alt`).
 *
 * - 401 → app-wide expired screen (same invariant as the lists/account).
 * - Any other error → FAIL SOFT: render nothing (never break the header/page).
 */
export function CustomerAvatar() {
  const onExpired = useOnExpired();
  const { data, error, isLoading } = useSWR('customer-profile', getProfile, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    onError: (err) => {
      if (err instanceof ApiError && err.kind === ApiErrorKind.Unauthorized) {
        onExpired();
      }
    },
  });

  // Fail soft on any error (a 401 has already been routed to the expired screen).
  if (error) {
    return null;
  }

  // Reserve the avatar slot while loading so the top row doesn't shift.
  if (isLoading || !data) {
    return <Skeleton className="size-10 shrink-0 rounded-full sm:size-12" />;
  }

  // kind="profile" + the customer's avatar UUID → the proxy's /profile/{uuid} picture.
  return (
    <SlAvatar kind="profile" uuid={data.uuid} alt={data.username} className="size-10 shrink-0 sm:size-12" />
  );
}
