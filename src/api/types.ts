// Wire types for the AS.ThirdPartyApi customer surface (`/v1/customer/*`).
// JSON is camelCase. SL texture UUIDs are plain GUID strings (or null).

/** GET /v1/customer/profile */
export interface CustomerProfile {
  uuid: string;
  username: string;
  /** SL texture UUID for the avatar picture; may be null. */
  pictureUuid: string | null;
}

/**
 * GET /v1/customer/context: the brand shown in the header plus the store(s) the
 * customer's items span. Single-store today; a collective adds more entries to
 * `stores` with no shape change (each list item resolves its store by id).
 */
export interface StoreContext {
  brand: Brand;
  stores: StoreRef[];
}

/** The brand for the header (a single store today, a collective's umbrella later). */
export interface Brand {
  name: string;
  /** SL texture UUID for the brand logo; may be null. */
  logo: string | null;
}

/** One store an item can belong to; resolved per item via its `storeId`. */
export interface StoreRef {
  id: string;
  name: string;
  /** SL texture UUID for the store logo; may be null. */
  logo: string | null;
}

/** Item shape of GET /v1/customer/redelivery/products */
export interface RedeliverableProduct {
  id: string;
  name: string;
  /** SL texture UUID for the product image; may be null. */
  image: string | null;
  /**
   * Owning store id. Carried for collective-readiness (resolve via the context's
   * `storesById`); the single-store UI does not use it yet.
   */
  storeId: string;
}

/**
 * One active credit lot backing a store's balance. The backend returns active lots
 * only (positive remaining, open, not expired), sorted `expiresAt` ascending, as
 * UTC ISO-8601 with a trailing `Z`; an empty array (including a zero-filled store)
 * means no dated credit. Restricted lots are shown as a separate section.
 */
export interface CreditLot {
  amount: number;
  /** UTC ISO-8601 timestamp with a trailing `Z`. */
  expiresAt: string;
  restricted: boolean;
}

/** One store's balances. An entry in the /account response. */
export interface StoreAccount {
  storeId: string;
  /** Store credit (an L$ amount). */
  credit: number;
  /** Restricted store credit (an L$ amount). */
  restrictedCredit: number;
  /** Loyalty discount as a raw percent (0–100), NOT a currency amount. */
  discount: number;
  /**
   * Active credit lots with expiry dates (soonest-first). OPTIONAL: older backends
   * omit it — treat absent/empty as "no dated credit" (the UI renders as before).
   * Normalized fail-soft at the single read site before use.
   */
  creditLots?: CreditLot[];
}

/**
 * GET /v1/customer/account — per-store balances. One entry for a single store, N for
 * a collective. Token-scoped server-side.
 */
export interface CustomerAccount {
  accounts: StoreAccount[];
}

/**
 * Item shape of GET /v1/customer/transactions. Field names mirror the backend
 * `CustomerTransactionResponse` record (camelCase). `type` is a numeric
 * `TransactionType` (mapped to a label in the UI — never trust the int range).
 */
export interface Transaction {
  /** React key only — never displayed. */
  id: string;
  payment: number;
  /** SL region name; may be empty → omit. */
  location: string;
  productName: string;
  storeName: string;
  /** Owning store id; carried for collective-readiness, not used by the single-store UI yet. */
  storeId: string;
  payerUsername: string;
  payerUuid: string;
  receiverUsername: string;
  receiverUuid: string;
  delivered: boolean;
  failedToDeliver: boolean;
  /** Numeric TransactionType (0..9 today); unknown ints render as a generic label. */
  type: number;
  /** ISO-8601 UTC timestamp. */
  created: string;
  /**
   * Internal coupon Guid. Presence means "a coupon was applied" — render it as a
   * boolean indicator only; NEVER display the value (it is an internal id).
   */
  usedCouponId: string | null;
  /**
   * Payer-only money breakdown: the backend populates these ONLY when the viewer
   * is the payer, and sends `null` otherwise. Render each ONLY when non-null —
   * never coerce a null to `L$ 0`.
   */
  usedCredit: number | null;
  usedDiscount: number | null;
  remainingCredit: number | null;
}

/**
 * Item shape of GET /v1/customer/giftcards. Mirrors the backend `GiftCardResponse`
 * record. Expired-unredeemed cards are hidden server-side and never appear here; all
 * other states (active/inactive/redeemed/zero-credit) are returned, so the UI renders
 * them and gates actions itself (and still filters `active && !redeemed` for display).
 */
export interface GiftCard {
  id: string;
  ownerUuid: string;
  ownerUsername: string;
  credit: number;
  active: boolean;
  redeemed: boolean;
  /** Whether this card is allowed to be transferred (gates the Transfer action). */
  transfer: boolean;
  /** SL texture UUID for the card art; may be null → fallback. */
  texture: string | null;
  /** Provenance label only (true = purchased, false = gifted); does NOT gate actions. */
  purchased: boolean;
  /** Owning store id; resolve the store (logo fallback) via the context's `storesById`. */
  storeId: string;
  /**
   * When the card's credit expires (UTC ISO-8601), or null/absent for no expiry.
   * The redeemed credit still expires on this date regardless of redeem time.
   */
  expiresAt?: string | null;
}

/**
 * Item shape of GET /v1/customer/news. Mirrors the backend `CustomerNewsPostResponse`
 * record (camelCase). A News Kiosk post the customer can see, optionally tied to
 * an on-demand item they can request in-world.
 */
export interface NewsPost {
  /** React key only — never displayed. */
  id: string;
  /** Owning store id; resolve the store (attribution chip) via the context's `storesById`. */
  storeId: string;
  /**
   * The post body. May contain `{username}` / `{name}` placeholders (substituted
   * per-viewer client-side) and bare URLs/emails (linkified client-side — never
   * via innerHTML).
   */
  message: string;
  /**
   * The associated item's display name, or null when the post has none. The
   * backend normalizes ""/none → null, so check `item != null` (never truthiness
   * on a possibly-empty string).
   */
  item: string | null;
  /** Whether the item is delivered on demand (gates the "Get item" affordance). */
  onDemandItem: boolean;
  /**
   * Server-computed: item present && onDemandItem && caller is an active
   * NewsSubscriber of the store. The UI uses this DIRECTLY to enable/disable
   * "Get item" — never recompute it client-side.
   */
  canRequestItem: boolean;
  /** ISO-8601 UTC timestamp. */
  created: string;
}

/**
 * GET /v1/customer/news/unread — the unread badge source. `byStore` has one entry
 * per in-scope store INCLUDING `count:0`; key it by `storeId` (order not guaranteed).
 */
export interface NewsUnread {
  total: number;
  byStore: { storeId: string; count: number }[];
}

/**
 * Generic cursor-pagination envelope returned by every list endpoint. Page
 * forward with `pagination.nextCursor` until it is null. Reused as-is by the
 * (future) transactions and gift-cards sections.
 */
export interface CursorEnvelope<T> {
  data: T[];
  pagination: CursorPagination;
}

export interface CursorPagination {
  nextCursor: string | null;
  previousCursor: string | null;
  limit: number;
}

/** RFC 9457 ProblemDetails (`application/problem+json`). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  /**
   * Top-level machine-discrimination code (e.g. `news_item_not_available`). Carried
   * through to `ApiError.code` so callers can map a specific failure to copy without
   * sniffing the HTTP status or parsing `detail`.
   */
  code?: string;
}

// Discriminated error kinds so the UI can render the right state without
// sniffing HTTP status codes everywhere. (const object + union: no TS enum,
// to satisfy `erasableSyntaxOnly`.)
export const ApiErrorKind = {
  /** No token held — show the "open from your store link" state. */
  NoToken: 'noToken',
  /** Missing `VITE_API_BASE_URL` — configuration problem. */
  Config: 'config',
  /** 401 — link expired/invalid/revoked. Token has been cleared. */
  Unauthorized: 'unauthorized',
  /** 429 — rate limited; `retryAfterSeconds` may be set. */
  RateLimited: 'rateLimited',
  /** 400/404 (or other non-ok) with a surfaced ProblemDetails message. */
  Problem: 'problem',
  /** fetch() rejected — offline / DNS / CORS / TLS. Offer a retry. */
  Network: 'network',
} as const;

export type ApiErrorKind = (typeof ApiErrorKind)[keyof typeof ApiErrorKind];

export interface ApiErrorOptions {
  status?: number;
  retryAfterSeconds?: number;
  /** Machine-discrimination code from ProblemDetails, when the backend sent one. */
  code?: string;
}

/** Typed error thrown by the API client. `kind` drives the UI state. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;
  /** ProblemDetails `code` (e.g. `news_subscription_required`); undefined when absent. */
  readonly code: string | undefined;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.code = options.code;
  }
}
