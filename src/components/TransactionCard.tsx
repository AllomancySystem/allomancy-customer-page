import type { Transaction } from '../api/types.ts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDateTime, formatLindens } from '../lib/format.ts';
import { useStore } from '../lib/useStore.ts';
import { SlAvatar } from './SlAvatar.tsx';
import { StoreChip } from './StoreChip.tsx';

// Numeric TransactionType → label. Const object (NOT a TS enum — `erasableSyntaxOnly`).
// Any unknown int falls back to a generic label rather than leaking the raw number.
const TRANSACTION_TYPE_LABELS: Record<number, string> = {
  0: 'Other',
  1: 'Purchase',
  2: 'ChooChoo',
  3: 'Redelivery',
  4: 'Website',
  5: 'Blog',
  6: 'Raffle',
  7: 'Gacha',
  8: 'LuckyChair',
  9: 'MidnightWin',
};

function transactionTypeLabel(type: number): string {
  return TRANSACTION_TYPE_LABELS[type] ?? 'Transaction';
}

/** A party (payer/receiver): avatar (via the frozen slImage proxy) + username. */
function Party({ uuid, username }: { uuid: string; username: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <SlAvatar uuid={uuid} kind="profile" alt="" className="size-6" />
      <span className="truncate">{username}</span>
    </span>
  );
}

/** A labelled money figure shown only when present (payer-only fields). */
function MoneyFact({ label, amount }: { label: string; amount: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{formatLindens(amount)}</dd>
    </div>
  );
}

/** One in-world transaction. `id` is the React key only and is never rendered. */
export function TransactionCard({ tx }: { tx: Transaction }) {
  const { storesById, isCollective } = useStore();

  // PRIVACY: usedCredit / usedDiscount / remainingCredit are payer-only — the backend
  // sends null to non-payers. Render each ONLY when non-null; never coerce to "L$ 0".
  const hasMoneyBreakdown =
    tx.usedCredit != null || tx.usedDiscount != null || tx.remainingCredit != null;

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {tx.productName && <p className="font-medium">{tx.productName}</p>}
          {/* Collectives label with the store's logo chip; single-store keeps the plain name. */}
          {isCollective ? (
            <StoreChip store={storesById[tx.storeId]} />
          ) : (
            <p className="text-sm text-muted-foreground">{tx.storeName}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="font-semibold whitespace-nowrap">{formatLindens(tx.payment)}</span>
          <Badge variant="secondary">{transactionTypeLabel(tx.type)}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <Party uuid={tx.payerUuid} username={tx.payerUsername} />
        <span aria-hidden="true" className="text-muted-foreground">
          →
        </span>
        <Party uuid={tx.receiverUuid} username={tx.receiverUsername} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{formatDateTime(tx.created)}</span>
        {tx.location && <span>· {tx.location}</span>}
        {tx.delivered ? (
          <Badge variant="secondary">Delivered</Badge>
        ) : tx.failedToDeliver ? (
          <Badge variant="destructive">Delivery failed</Badge>
        ) : null}
        {/* usedCouponId is an internal Guid: show presence only, never the value. */}
        {tx.usedCouponId != null && <Badge variant="outline">Coupon applied</Badge>}
      </div>

      {hasMoneyBreakdown && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {tx.usedCredit != null && <MoneyFact label="Store credit used" amount={tx.usedCredit} />}
          {tx.usedDiscount != null && <MoneyFact label="Discount" amount={tx.usedDiscount} />}
          {tx.remainingCredit != null && (
            <MoneyFact label="Remaining credit" amount={tx.remainingCredit} />
          )}
        </dl>
      )}
    </Card>
  );
}
