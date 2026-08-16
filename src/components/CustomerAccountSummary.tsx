import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCustomerAccount } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type StoreAccount, type StoreRef } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import {
  UrgencyTier,
  formatExpiry,
  formatRelativeCountdown,
  groupLotsByDate,
  normalizeAccounts,
  urgencyTier,
  type CreditLotRow,
} from '../lib/creditExpiry.ts';
import { formatLindens } from '../lib/format.ts';
import { useStore } from '../lib/useStore.ts';
import { ExpiringCreditDetails } from './ExpiringCreditDetails.tsx';
import { ChevronIcon } from './icons/ChevronIcon.tsx';
import { TriangleAlertIcon } from './icons/TriangleAlertIcon.tsx';

// Labels for the three balances. Edit these strings to relabel/translate the block.
const LABELS = {
  credit: 'Credit',
  restrictedCredit: 'Restricted credit',
  discount: 'Discount',
};

/** One compact inline label+value pair. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** The flat single-store balance row. Byte-for-byte the pre-collective layout. */
function SingleStoreRow({ account }: { account: StoreAccount }) {
  return (
    <dl
      aria-label="Account summary"
      className="flex flex-wrap gap-x-4 gap-y-1 py-0.5 text-xs sm:text-sm"
    >
      <Fact label={LABELS.credit} value={formatLindens(account.credit)} />
      <Fact label={LABELS.restrictedCredit} value={formatLindens(account.restrictedCredit)} />
      {/* Discount is a raw percent (0–100), not currency. */}
      <Fact label={LABELS.discount} value={`${account.discount}%`} />
    </dl>
  );
}

/**
 * The ≤30d expiry callout: a one-line urgent notice for the soonest-to-expire lot
 * row. Renders nothing unless that row is within the urgency window (amber ≤30d,
 * red ≤7d — never color alone: paired with the warning-triangle icon per FD5).
 * `storeName`, when given (collective aggregate), is appended to name the store.
 */
function ExpiryCallout({
  row,
  now,
  storeName,
}: {
  row: CreditLotRow;
  now: Date;
  storeName?: string;
}) {
  const date = new Date(row.expiresAt);
  const tier = urgencyTier(date, now);
  if (tier === UrgencyTier.None) {
    return null;
  }

  return (
    <p
      className={cn(
        'flex items-center gap-1 text-sm font-medium',
        tier === UrgencyTier.Danger
          ? 'text-red-600 dark:text-red-400'
          : 'text-amber-600 dark:text-amber-400',
      )}
    >
      <TriangleAlertIcon className="h-4 w-4 shrink-0" />
      <span>
        {formatLindens(row.amount)} expires{' '}
        <time dateTime={row.expiresAt}>{formatExpiry(date)}</time>{' '}
        ({formatRelativeCountdown(date, now)}){storeName ? ` at ${storeName}` : ''}
      </span>
    </p>
  );
}

/**
 * Single-store balances: the flat `<dl>` (unchanged), plus — when the store has
 * dated credit — the ≤30d callout, the spend-order explainer, and a collapsed
 * "Credit details" disclosure (button + local state, per the repo's disclosure
 * precedent) holding the §5.1 breakdown. With no dated credit it renders exactly
 * as before (just the `<dl>`).
 */
function SingleStoreCredit({ account, now }: { account: StoreAccount; now: Date }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lots = account.creditLots ?? [];
  const soonestRow = groupLotsByDate(lots)[0];

  return (
    <>
      <SingleStoreRow account={account} />
      {soonestRow && (
        <div className="mt-2 flex flex-col gap-1">
          <ExpiryCallout row={soonestRow} now={now} />
          <p className="text-sm text-muted-foreground">
            Your soonest-to-expire credit is always used first.
          </p>
          <Button
            type="button"
            variant="link"
            className="h-auto w-fit justify-start gap-1 p-0 text-sm"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((prev) => !prev)}
          >
            <ChevronIcon open={detailsOpen} className="h-4 w-4" />
            Credit details
          </Button>
          {detailsOpen && (
            <ExpiringCreditDetails
              lots={lots}
              creditTotal={account.credit}
              restrictedCreditTotal={account.restrictedCredit}
              now={now}
            />
          )}
        </div>
      )}
    </>
  );
}

/**
 * Collective balances: a compact aggregate line (total credit + total restricted,
 * plus an N-stores toggle) that expands to a per-store breakdown. Discount is a
 * per-store percent, so it is NOT summed; it shows only in the breakdown. Header
 * space is precious, so the breakdown is collapsed by default.
 *
 * Expiry: the aggregate gains a single callout for the globally soonest lot (naming
 * its store); inside the expansion each store gains its own §5.1 credit breakdown.
 */
function CollectiveBalances({
  accounts,
  storesById,
  now,
}: {
  accounts: StoreAccount[];
  storesById: Record<string, StoreRef>;
  now: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalCredit = accounts.reduce((n, a) => n + a.credit, 0);
  const totalRestricted = accounts.reduce((n, a) => n + a.restrictedCredit, 0);

  // The globally soonest-to-expire lot row across all stores, tagged with its store
  // name for the aggregate callout. Stable on ties (first store in account order).
  const soonest = accounts
    .map((a) => {
      const row = groupLotsByDate(a.creditLots ?? [])[0];
      return row ? { row, storeName: storesById[a.storeId]?.name ?? 'Store' } : null;
    })
    .filter((entry): entry is { row: CreditLotRow; storeName: string } => entry !== null)
    .sort((a, b) => new Date(a.row.expiresAt).getTime() - new Date(b.row.expiresAt).getTime())[0];

  return (
    <div className="flex flex-col gap-1 py-0.5 text-xs sm:text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Fact label={LABELS.credit} value={formatLindens(totalCredit)} />
        <Fact label={LABELS.restrictedCredit} value={formatLindens(totalRestricted)} />
        <span className="text-muted-foreground underline-offset-2 hover:underline">
          {expanded ? 'Hide' : 'Show'} {accounts.length} stores
        </span>
      </button>

      {soonest && <ExpiryCallout row={soonest.row} now={now} storeName={soonest.storeName} />}

      {expanded && (
        <ul className="mt-1 flex flex-col gap-3 border-t pt-1">
          {accounts.map((a) => (
            <li key={a.storeId} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="min-w-0 truncate font-medium">
                  {storesById[a.storeId]?.name ?? 'Store'}
                </span>
                <span className="text-muted-foreground">
                  {LABELS.credit}{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatLindens(a.credit)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {LABELS.restrictedCredit}{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatLindens(a.restrictedCredit)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {LABELS.discount}{' '}
                  <span className="font-semibold tabular-nums text-foreground">{a.discount}%</span>
                </span>
              </div>
              {(a.creditLots?.length ?? 0) > 0 && (
                <ExpiringCreditDetails
                  lots={a.creditLots ?? []}
                  creditTotal={a.credit}
                  restrictedCreditTotal={a.restrictedCredit}
                  now={now}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Store balances row for the sticky header. Consumes the per-store `/account` list:
 * one entry renders the flat single-store row (plus its expiry additions); N entries
 * render the collective aggregate + expandable per-store breakdown. Credit lots are
 * normalized fail-soft here (the single read site) so both paths consume clean data.
 *
 * - 401 → app-wide expired screen; any other error fails soft (renders nothing).
 */
export function CustomerAccountSummary() {
  const onExpired = useOnExpired();
  const { storesById } = useStore();
  const { data, error, isLoading } = useSWR('customer-account', getCustomerAccount, {
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

  // Flat one-line skeleton — reserves the row height with no layout shift.
  if (isLoading || !data) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 py-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
    );
  }

  // CP8 fail-soft: normalize creditLots once, here, before either path consumes it.
  const accounts = normalizeAccounts(data.accounts);
  const now = new Date();
  if (accounts.length <= 1) {
    const only = accounts[0];
    return only ? <SingleStoreCredit account={only} now={now} /> : null;
  }
  return <CollectiveBalances accounts={accounts} storesById={storesById} now={now} />;
}
