// Pure, dependency-free helpers for the expiring-credits display. Native Intl/Date
// only — this template intentionally ships no date library and must not gain one.
// `now` is always a parameter so every function is pure and deterministic.

import type { CreditLot, StoreAccount } from '../api/types.ts';

/**
 * FD5 urgency ramp for an expiry date: neutral → amber (≤30d) → red (≤7d); a date
 * in the past is `danger`. Const-object union (no TS enum, per `erasableSyntaxOnly`).
 */
export const UrgencyTier = {
  None: 'none',
  Warn: 'warn',
  Danger: 'danger',
} as const;

export type UrgencyTier = (typeof UrgencyTier)[keyof typeof UrgencyTier];

const DAY_MS = 86_400_000;

/** One grouped display row: every lot sharing this exact expiry instant, summed. */
export interface CreditLotRow {
  /** The exact ISO instant shared by every lot summed into this row. */
  expiresAt: string;
  amount: number;
}

// A single fixed formatter (`en-US`, spelled short month) reused across renders.
// No `timeZone` option → formats in the runtime's local zone, keeping the shown
// date consistent with the local-calendar-day countdown below (ecosystem parity
// with the sites apps' date-fns behavior).
const EXPIRY_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Absolute spelled-month date, e.g. `Aug 31, 2026`. */
export function formatExpiry(date: Date): string {
  return EXPIRY_FORMAT.format(date);
}

/**
 * CP8 fail-soft: is this value a string that `new Date(...)` can actually parse?
 * Guards every place an `expiresAt` becomes a `Date` fed to `Intl.DateTimeFormat`,
 * since a truthy-but-unparseable string (e.g. `"not-a-date"`) would otherwise reach
 * `format(new Date(...))` and throw a `RangeError`, crashing the render. Returns a
 * type predicate so callers narrow to `string`. Pure.
 */
export function isRenderableExpiry(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Calendar-day difference in the local zone (matches date-fns
 * `differenceInCalendarDays`). Normalizes each date to its local Y/M/D at UTC
 * midnight before subtracting, so DST shifts never skew the day count.
 */
function differenceInCalendarDays(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / DAY_MS);
}

/**
 * Relative countdown for a soon-to-expire date (only ever shown for dates within
 * the ≤30d callout): `Today` on the same calendar day or already past, `Tomorrow`
 * the next day, otherwise `in N days`. Pure (`now` is a parameter).
 */
export function formatRelativeCountdown(expiresAt: Date, now: Date): string {
  const days = differenceInCalendarDays(expiresAt, now);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Tomorrow';
  }
  return `in ${days} days`;
}

/**
 * FD5 urgency tier: `danger` within 7 days (or past), `warn` within 30, else
 * `none`. Instant comparison; pure (`now` is a parameter).
 */
export function urgencyTier(expiresAt: Date, now: Date): UrgencyTier {
  const ms = expiresAt.getTime();
  if (ms <= now.getTime() + 7 * DAY_MS) {
    return UrgencyTier.Danger;
  }
  if (ms <= now.getTime() + 30 * DAY_MS) {
    return UrgencyTier.Warn;
  }
  return UrgencyTier.None;
}

/**
 * Groups a homogeneous (single credit type) lot list by LOCAL CALENDAR DATE (the
 * date each row displays), summing amounts. Lot `expiresAt` are grant-time-of-day
 * UTC instants, so two lots on the same local day must collapse to one row (FD3
 * "same-date lots summed"). Each group keeps its EARLIEST instant as the
 * representative `expiresAt` — it drives the shown date, the `<time>` value,
 * urgency, and ordering. Returned ascending by that earliest instant.
 * Self-sorting, so it never relies on caller ordering. Pure and deterministic.
 */
export function groupLotsByDate(lots: CreditLot[]): CreditLotRow[] {
  const groups = new Map<string, { earliest: string; amount: number }>();
  for (const lot of lots) {
    const d = new Date(lot.expiresAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += lot.amount;
      if (new Date(lot.expiresAt).getTime() < new Date(existing.earliest).getTime()) {
        existing.earliest = lot.expiresAt;
      }
    } else {
      groups.set(key, { earliest: lot.expiresAt, amount: lot.amount });
    }
  }
  return Array.from(groups.values(), ({ earliest, amount }) => ({ expiresAt: earliest, amount })).sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  );
}

/**
 * Unlotted remainder for one credit type = total balance − sum of that type's lot
 * amounts. Clamped at ≥ 0 (a caller renders the "no expiry" row only when the
 * result is > 0). Pure and deterministic.
 */
export function unlottedRemainder(totalBalance: number, lots: CreditLot[]): number {
  const lotted = lots.reduce((sum, lot) => sum + lot.amount, 0);
  return Math.max(0, totalBalance - lotted);
}

/**
 * CP8 fail-soft: normalize each account's `creditLots` to a clean array. The API
 * client casts JSON with a raw `as T`, so runtime shape is not guaranteed — a
 * non-array (or a non-array `accounts` itself) becomes `[]`, and entries missing a
 * numeric `amount` or an unparseable `expiresAt` are dropped (an unparseable date
 * would crash the render at `Intl.DateTimeFormat.format`). Absent / null /
 * partially-malformed data all degrade to today's render. No deeper schema
 * validation (the backend is ours and typed).
 */
export function normalizeAccounts(accounts: StoreAccount[]): StoreAccount[] {
  return Array.isArray(accounts)
    ? accounts.map((account) => ({
        ...account,
        creditLots: Array.isArray(account.creditLots)
          ? (account.creditLots as unknown[]).filter(
              (lot): lot is CreditLot =>
                typeof lot === 'object' &&
                lot !== null &&
                typeof (lot as CreditLot).amount === 'number' &&
                isRenderableExpiry((lot as CreditLot).expiresAt),
            )
          : [],
      }))
    : [];
}
