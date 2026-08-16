import { describe, it, expect } from 'vitest';

import {
  formatExpiry,
  formatRelativeCountdown,
  urgencyTier,
  groupLotsByDate,
  unlottedRemainder,
  normalizeAccounts,
  isRenderableExpiry,
} from './creditExpiry';
import type { CreditLot, StoreAccount } from '../api/types';

const DAY_MS = 86_400_000;

// All Date inputs below are built from LOCAL components — `new Date(y, m, d, …)`
// (month is 0-based) — so the spelled date and the calendar-day countdown are
// stable in any runner time zone; nothing here depends on UTC parsing.

describe('formatExpiry', () => {
  it('formats a local date as a spelled short month, e.g. "Aug 31, 2026"', () => {
    // month 7 === August (0-based)
    expect(formatExpiry(new Date(2026, 7, 31))).toBe('Aug 31, 2026');
  });

  it('formats a single-digit day without zero-padding', () => {
    expect(formatExpiry(new Date(2026, 0, 5))).toBe('Jan 5, 2026');
  });
});

describe('formatRelativeCountdown', () => {
  it('returns "Today" for the same local calendar day at a different time', () => {
    const now = new Date(2026, 6, 17, 9, 0, 0);
    const expiresAt = new Date(2026, 6, 17, 20, 30, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('Today');
  });

  it('returns "Tomorrow" for the next local calendar day', () => {
    const now = new Date(2026, 6, 17, 9, 0, 0);
    const expiresAt = new Date(2026, 6, 18, 9, 0, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('Tomorrow');
  });

  it('is calendar-day based, not 24h: only a few hours apart but one day forward → "Tomorrow"', () => {
    // 23:00 → 02:00 next day = 3 hours later, but a calendar day ahead.
    const now = new Date(2026, 6, 17, 23, 0, 0);
    const expiresAt = new Date(2026, 6, 18, 2, 0, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('Tomorrow');
  });

  it('returns "in N days" for 12 calendar days ahead', () => {
    const now = new Date(2026, 6, 17, 9, 0, 0);
    const expiresAt = new Date(2026, 6, 29, 9, 0, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('in 12 days');
  });

  it('returns "in N days" for 30 calendar days ahead', () => {
    const now = new Date(2026, 6, 1, 9, 0, 0);
    const expiresAt = new Date(2026, 6, 31, 9, 0, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('in 30 days');
  });

  it('returns "Today" for a past instant', () => {
    const now = new Date(2026, 6, 17, 12, 0, 0);
    const expiresAt = new Date(2026, 6, 10, 12, 0, 0);
    expect(formatRelativeCountdown(expiresAt, now)).toBe('Today');
  });
});

describe('urgencyTier', () => {
  const now = new Date(2026, 6, 17, 12, 0, 0);

  it('is "danger" for a past expiry', () => {
    expect(urgencyTier(new Date(now.getTime() - DAY_MS), now)).toBe('danger');
  });

  it('is "danger" just inside 7 days', () => {
    expect(urgencyTier(new Date(now.getTime() + 7 * DAY_MS - 60_000), now)).toBe('danger');
  });

  it('is "warn" at 8 days (past the danger threshold)', () => {
    expect(urgencyTier(new Date(now.getTime() + 8 * DAY_MS), now)).toBe('warn');
  });

  it('is "warn" just inside 30 days', () => {
    expect(urgencyTier(new Date(now.getTime() + 30 * DAY_MS - 60_000), now)).toBe('warn');
  });

  it('is "none" past 30 days', () => {
    expect(urgencyTier(new Date(now.getTime() + 31 * DAY_MS), now)).toBe('none');
  });
});

describe('groupLotsByDate', () => {
  const lot = (amount: number, expiresAt: string, restricted = false): CreditLot => ({
    amount,
    expiresAt,
    restricted,
  });

  it('returns [] for an empty list', () => {
    expect(groupLotsByDate([])).toEqual([]);
  });

  it('returns a single row for a single lot', () => {
    expect(groupLotsByDate([lot(100, '2026-08-31T00:00:00Z')])).toEqual([
      { expiresAt: '2026-08-31T00:00:00Z', amount: 100 },
    ]);
  });

  it('sums two lots sharing the exact same expiry instant into one row', () => {
    expect(
      groupLotsByDate([lot(100, '2026-08-31T00:00:00Z'), lot(50, '2026-08-31T00:00:00Z')]),
    ).toEqual([{ expiresAt: '2026-08-31T00:00:00Z', amount: 150 }]);
  });

  it('keeps distinct expiry instants as separate rows', () => {
    expect(
      groupLotsByDate([lot(100, '2026-08-31T00:00:00Z'), lot(50, '2026-09-30T00:00:00Z')]),
    ).toEqual([
      { expiresAt: '2026-08-31T00:00:00Z', amount: 100 },
      { expiresAt: '2026-09-30T00:00:00Z', amount: 50 },
    ]);
  });

  it('self-sorts ascending by expiry regardless of input order', () => {
    expect(
      groupLotsByDate([
        lot(30, '2026-10-31T00:00:00Z'),
        lot(10, '2026-08-31T00:00:00Z'),
        lot(20, '2026-09-30T00:00:00Z'),
      ]),
    ).toEqual([
      { expiresAt: '2026-08-31T00:00:00Z', amount: 10 },
      { expiresAt: '2026-09-30T00:00:00Z', amount: 20 },
      { expiresAt: '2026-10-31T00:00:00Z', amount: 30 },
    ]);
  });

  it('sums by date only, ignoring the restricted flag', () => {
    expect(
      groupLotsByDate([
        lot(100, '2026-08-31T00:00:00Z', false),
        lot(25, '2026-08-31T00:00:00Z', true),
      ]),
    ).toEqual([{ expiresAt: '2026-08-31T00:00:00Z', amount: 125 }]);
  });

  // Instants built from LOCAL components then serialized with .toISOString(), so
  // "same/different local date" holds in ANY runner time zone (not just UTC).
  it('sums two lots on the same local calendar date at different times, keeping the earliest instant', () => {
    // Both fall on July 30 LOCAL (01:00 and 23:00); input order reversed to prove
    // the row's expiresAt is the EARLIER instant, not the first seen.
    const earlier = new Date(2026, 6, 30, 1, 0, 0).toISOString();
    const later = new Date(2026, 6, 30, 23, 0, 0).toISOString();
    expect(groupLotsByDate([lot(200, later), lot(300, earlier)])).toEqual([
      { expiresAt: earlier, amount: 500 },
    ]);
  });

  it('keeps two lots straddling local midnight as two separate ascending rows', () => {
    // July 30 23:00 LOCAL and July 31 01:00 LOCAL — distinct local dates in any zone.
    const jul30 = new Date(2026, 6, 30, 23, 0, 0).toISOString();
    const jul31 = new Date(2026, 6, 31, 1, 0, 0).toISOString();
    expect(groupLotsByDate([lot(100, jul30), lot(50, jul31)])).toEqual([
      { expiresAt: jul30, amount: 100 },
      { expiresAt: jul31, amount: 50 },
    ]);
  });
});

describe('unlottedRemainder', () => {
  const lot = (amount: number): CreditLot => ({
    amount,
    expiresAt: '2026-08-31T00:00:00Z',
    restricted: false,
  });

  it('is total minus the summed lot amounts when positive', () => {
    expect(unlottedRemainder(500, [lot(100), lot(150)])).toBe(250);
  });

  it('is exactly 0 when lots equal the total', () => {
    expect(unlottedRemainder(250, [lot(100), lot(150)])).toBe(0);
  });

  it('clamps a would-be-negative remainder to 0', () => {
    expect(unlottedRemainder(100, [lot(150)])).toBe(0);
  });

  it('returns the full total when there are no lots', () => {
    expect(unlottedRemainder(300, [])).toBe(300);
  });
});

describe('isRenderableExpiry', () => {
  it('is true for a parseable ISO instant string', () => {
    expect(isRenderableExpiry('2026-08-31T00:00:00Z')).toBe(true);
  });

  it('is true for a parseable plain date string', () => {
    expect(isRenderableExpiry('2026-08-31')).toBe(true);
  });

  it('is false for an unparseable garbage string', () => {
    expect(isRenderableExpiry('not-a-date')).toBe(false);
  });

  it('is false for an empty string', () => {
    expect(isRenderableExpiry('')).toBe(false);
  });

  it('is false for a number', () => {
    expect(isRenderableExpiry(1_756_598_400_000)).toBe(false);
  });

  it('is false for null', () => {
    expect(isRenderableExpiry(null)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isRenderableExpiry(undefined)).toBe(false);
  });

  it('is false for an object', () => {
    expect(isRenderableExpiry({})).toBe(false);
  });

  it('is false for an array', () => {
    expect(isRenderableExpiry([])).toBe(false);
  });
});

describe('normalizeAccounts', () => {
  const account = (overrides: Partial<StoreAccount>): StoreAccount => ({
    storeId: 'store-1',
    credit: 500,
    restrictedCredit: 100,
    discount: 10,
    ...overrides,
  });

  it('keeps a clean array of valid lots and preserves the other fields', () => {
    const lots: CreditLot[] = [
      { amount: 100, expiresAt: '2026-08-31T00:00:00Z', restricted: false },
      { amount: 50, expiresAt: '2026-09-30T00:00:00Z', restricted: true },
    ];
    const [result] = normalizeAccounts([account({ creditLots: lots })]);
    expect(result!.creditLots).toEqual(lots);
    expect(result!.storeId).toBe('store-1');
    expect(result!.credit).toBe(500);
    expect(result!.restrictedCredit).toBe(100);
    expect(result!.discount).toBe(10);
  });

  it('coerces `creditLots: undefined` to []', () => {
    const [result] = normalizeAccounts([account({ creditLots: undefined })]);
    expect(result!.creditLots).toEqual([]);
  });

  it('coerces `creditLots: null` to []', () => {
    const input = [account({ creditLots: null as unknown as CreditLot[] })];
    const [result] = normalizeAccounts(input);
    expect(result!.creditLots).toEqual([]);
  });

  it('coerces a non-array `creditLots` (object) to []', () => {
    const input = [account({ creditLots: {} as unknown as CreditLot[] })];
    const [result] = normalizeAccounts(input);
    expect(result!.creditLots).toEqual([]);
  });

  it('coerces a non-array `creditLots` (string) to []', () => {
    const input = [account({ creditLots: 'x' as unknown as CreditLot[] })];
    const [result] = normalizeAccounts(input);
    expect(result!.creditLots).toEqual([]);
  });

  it('drops malformed entries and keeps only well-formed lots', () => {
    const valid: CreditLot = { amount: 100, expiresAt: '2026-08-31T00:00:00Z', restricted: false };
    const malformed = [
      valid,
      { expiresAt: '2026-08-31T00:00:00Z', restricted: false }, // missing amount
      { amount: '100', expiresAt: '2026-08-31T00:00:00Z', restricted: false }, // amount not a number
      { amount: 100, restricted: false }, // missing expiresAt
      { amount: 100, expiresAt: 12345, restricted: false }, // expiresAt not a string
      null, // null entry
      'not-an-object', // non-object entry
    ];
    const input = [account({ creditLots: malformed as unknown as CreditLot[] })];
    const [result] = normalizeAccounts(input);
    expect(result!.creditLots).toEqual([valid]);
    // other fields untouched by the filtering
    expect(result!.credit).toBe(500);
    expect(result!.restrictedCredit).toBe(100);
    expect(result!.discount).toBe(10);
  });

  describe('non-array `accounts` argument degrades to []', () => {
    it('returns [] for `undefined`', () => {
      expect(normalizeAccounts(undefined as unknown as StoreAccount[])).toEqual([]);
    });

    it('returns [] for `null`', () => {
      expect(normalizeAccounts(null as unknown as StoreAccount[])).toEqual([]);
    });

    it('returns [] for a non-array object', () => {
      expect(normalizeAccounts({} as unknown as StoreAccount[])).toEqual([]);
    });

    it('returns [] for a string', () => {
      expect(normalizeAccounts('accounts' as unknown as StoreAccount[])).toEqual([]);
    });
  });

  it('drops a lot with a truthy-but-unparseable `expiresAt` while keeping a valid sibling', () => {
    const valid: CreditLot = { amount: 100, expiresAt: '2026-08-31T00:00:00Z', restricted: false };
    const unparseable = { amount: 50, expiresAt: 'not-a-date', restricted: false };
    const input = [account({ creditLots: [unparseable as unknown as CreditLot, valid] })];
    const [result] = normalizeAccounts(input);
    expect(result!.creditLots).toEqual([valid]);
    expect(result!.storeId).toBe('store-1');
    expect(result!.credit).toBe(500);
    expect(result!.restrictedCredit).toBe(100);
    expect(result!.discount).toBe(10);
  });
});
