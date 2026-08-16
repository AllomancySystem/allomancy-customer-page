import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreditLot } from '../api/types.ts';
import {
  UrgencyTier,
  formatExpiry,
  groupLotsByDate,
  unlottedRemainder,
  urgencyTier,
  type CreditLotRow,
} from '../lib/creditExpiry.ts';
import { formatLindens } from '../lib/format.ts';
import { ClockIcon } from './icons/ClockIcon.tsx';

interface ExpiringCreditDetailsProps {
  lots: CreditLot[];
  creditTotal: number;
  restrictedCreditTotal: number;
  /** Injectable for deterministic urgency; defaults to the real clock. */
  now?: Date;
}

const MAX_VISIBLE_ROWS = 3;

type DisplayRow = { kind: 'dated'; row: CreditLotRow } | { kind: 'none'; amount: number };

/** One dated row: summed amount, its expiry date, an urgency chip when ≤30d, and a
 * "next to be used" cue on the soonest row (spend order is soonest-first). */
function DatedRow({ row, isNext, now }: { row: CreditLotRow; isNext: boolean; now: Date }) {
  const date = new Date(row.expiresAt);
  const tier = urgencyTier(date, now);

  return (
    <li className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium tabular-nums">{formatLindens(row.amount)}</span>
      <span className="flex items-center gap-2 text-muted-foreground">
        expires{' '}
        <time dateTime={row.expiresAt} className="font-medium text-foreground">
          {formatExpiry(date)}
        </time>
      </span>
      {tier !== UrgencyTier.None && (
        <Badge
          variant={tier === UrgencyTier.Danger ? 'destructive' : 'outline'}
          className={cn(
            'gap-1',
            tier === UrgencyTier.Warn && 'border-amber-500 text-amber-600 dark:text-amber-400',
          )}
        >
          <ClockIcon />
          Expires soon
        </Badge>
      )}
      {isNext && <span className="text-xs italic text-muted-foreground">next to be used</span>}
    </li>
  );
}

/** The trailing remainder row: credit of this type with no expiry attached. */
function NoExpiryRow({ amount }: { amount: number }) {
  return (
    <li className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium tabular-nums">{formatLindens(amount)}</span>
      <span className="text-muted-foreground">no expiry</span>
    </li>
  );
}

/** One credit type's section: its dated rows + optional remainder, capped at
 * three visible rows behind a "+ show N more" toggle (button + local state). */
function CreditSection({
  title,
  rows,
  remainder,
  now,
}: {
  title: string;
  rows: CreditLotRow[];
  remainder: number;
  now: Date;
}) {
  const [expanded, setExpanded] = useState(false);

  const items: DisplayRow[] = [
    ...rows.map((row) => ({ kind: 'dated' as const, row })),
    ...(remainder > 0 ? [{ kind: 'none' as const, amount: remainder }] : []),
  ];

  const visible = expanded ? items : items.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {visible.map((item, index) =>
          item.kind === 'dated' ? (
            <DatedRow key={item.row.expiresAt} row={item.row} isNext={index === 0} now={now} />
          ) : (
            <NoExpiryRow key="no-expiry" amount={item.amount} />
          ),
        )}
      </ul>
      {hiddenCount > 0 && (
        <Button
          type="button"
          variant="link"
          className="h-auto w-fit justify-start p-0 text-xs"
          onClick={() => setExpanded(true)}
        >
          {`+ show ${hiddenCount} more`}
        </Button>
      )}
    </div>
  );
}

/**
 * The §5.1 two-section credit breakdown: "Store credit" + "Restricted credit",
 * one row per exact expiry instant (summed, ascending) plus a trailing "no expiry"
 * remainder row, each section capped at three rows. Presentational and pure —
 * reused for the single store (inside the "Credit details" disclosure) and for
 * each per-store row inside the collective's "Show N stores" expansion. Renders
 * nothing when neither credit type has dated lots.
 */
export function ExpiringCreditDetails({
  lots,
  creditTotal,
  restrictedCreditTotal,
  now = new Date(),
}: ExpiringCreditDetailsProps) {
  const storeLots = lots.filter((lot) => !lot.restricted);
  const restrictedLots = lots.filter((lot) => lot.restricted);

  const storeRows = groupLotsByDate(storeLots);
  const restrictedRows = groupLotsByDate(restrictedLots);

  const hasStore = storeRows.length > 0;
  const hasRestricted = restrictedRows.length > 0;

  if (!hasStore && !hasRestricted) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-3">
      {hasStore && (
        <CreditSection
          title="Store credit"
          rows={storeRows}
          remainder={unlottedRemainder(creditTotal, storeLots)}
          now={now}
        />
      )}
      {hasRestricted && (
        <CreditSection
          title="Restricted credit"
          rows={restrictedRows}
          remainder={unlottedRemainder(restrictedCreditTotal, restrictedLots)}
          now={now}
        />
      )}
    </div>
  );
}
