// ============================================================================
// API CLIENT — the ONLY module that talks to the network.
// ============================================================================
// One typed method per endpoint. Page components stay thin and presentational.
// Auth is the `X-Customer-Token` header on every call — NO cookies, NO
// Authorization, NO API key, and `credentials: 'omit'` (the CORS policy is
// no-credentials). The token itself is never logged.
// ============================================================================

import { clearToken, getToken } from '../auth/token.ts';
import {
  ApiError,
  ApiErrorKind,
  type CursorEnvelope,
  type CustomerAccount,
  type CustomerProfile,
  type GiftCard,
  type NewsPost,
  type NewsUnread,
  type ProblemDetails,
  type RedeliverableProduct,
  type StoreContext,
  type Transaction,
} from './types.ts';

/** Default page size for the products list (matches the backend's ~24). */
export const DEFAULT_PAGE_LIMIT = 24;

// Backend base URL. Hard-coded to the prod AS.ThirdPartyApi so a fresh fork works
// with ZERO env config — the backend is operated by Allomancy, not the merchant, so
// a merchant deploying this template never sets it. Override ONLY for local dev via
// VITE_API_BASE_URL (see .env.example). Requests are `${base}/v1/customer/...`; the
// trailing slash is trimmed so the join never doubles up.
const DEFAULT_API_BASE_URL = 'https://integrations.allomancy.net';

function baseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
}

async function readProblem(response: Response): Promise<{ message?: string; code?: string }> {
  try {
    const problem = (await response.json()) as ProblemDetails;
    // Prefer the specific `detail`, fall back to the `title`. `code` is the
    // top-level machine discriminator (carried onto ApiError for callers to map).
    return { message: problem.detail ?? problem.title ?? undefined, code: problem.code };
  } catch {
    return {};
  }
}

/**
 * Shared transport core: resolves the token, attaches the header, and maps every
 * failure mode to a typed `ApiError` the UI can switch on. Returns the validated
 * (2xx) `Response` WITHOUT touching its body — the wrappers below decide whether
 * a body is expected (`request`) or not (`requestNoContent`).
 */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new ApiError(ApiErrorKind.NoToken, 'No customer token for this session.');
  }

  const headers = new Headers(init?.headers);
  headers.set('X-Customer-Token', token);
  headers.set('Accept', 'application/json');
  if (init?.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers,
      credentials: 'omit',
    });
  } catch {
    // Network / DNS / CORS / TLS failure — offer a retry, do not clear the token.
    throw new ApiError(ApiErrorKind.Network, 'Could not reach the store. Check your connection and try again.');
  }

  if (response.status === 401) {
    // Link is dead — forget the token so we don't loop retrying with it.
    clearToken();
    throw new ApiError(ApiErrorKind.Unauthorized, 'Your link has expired.', { status: 401 });
  }

  if (response.status === 429) {
    const header = response.headers.get('Retry-After');
    const seconds = header != null ? Number(header) : Number.NaN;
    throw new ApiError(ApiErrorKind.RateLimited, 'Please wait a moment and try again.', {
      status: 429,
      retryAfterSeconds: Number.isFinite(seconds) ? seconds : undefined,
    });
  }

  if (!response.ok) {
    const { message, code } = await readProblem(response);
    throw new ApiError(ApiErrorKind.Problem, message ?? `Request failed (${response.status}).`, {
      status: response.status,
      code,
    });
  }

  return response;
}

/** `send()` + JSON body. For endpoints whose 2xx contract includes a payload. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  return (await response.json()) as T;
}

/**
 * `send()` with the body ignored. For endpoints that reply with no body
 * (204 No Content) — or whose body the caller ignores — so an empty payload
 * does not throw the way `response.json()` would.
 */
async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await send(path, init);
}

/** GET /v1/customer/profile — the customer to greet. */
export function getProfile(): Promise<CustomerProfile> {
  return request<CustomerProfile>('/v1/customer/profile');
}

/** GET /v1/customer/context: the brand and the store(s) the customer's items span. */
export function getStoreContext(): Promise<StoreContext> {
  return request<StoreContext>('/v1/customer/context');
}

/** GET /v1/customer/account — the customer's store credit / restricted credit / discount. */
export function getCustomerAccount(): Promise<CustomerAccount> {
  return request<CustomerAccount>('/v1/customer/account');
}

/** GET /v1/customer/redelivery/products — one page of redeliverable products. */
export function getRedeliverableProducts(
  limit: number = DEFAULT_PAGE_LIMIT,
  cursor?: string | null,
  storeId?: string | null,
): Promise<CursorEnvelope<RedeliverableProduct>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  if (storeId) {
    params.set('storeId', storeId);
  }
  return request<CursorEnvelope<RedeliverableProduct>>(`/v1/customer/redelivery/products?${params.toString()}`);
}

/** POST /v1/customer/redelivery — request a redelivery of one product. */
export function requestRedelivery(productId: string): Promise<boolean> {
  return request<boolean>('/v1/customer/redelivery', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

// ---------------------------------------------------------------------------
// Transactions & gift cards (additive — all go through the same `request()`
// helper, so they inherit the X-Customer-Token attach, credentials:'omit',
// and the 401/429/ProblemDetails handling above).
// ---------------------------------------------------------------------------

/** GET /v1/customer/transactions — one page of the customer's in-world transactions. */
export function getTransactions(
  limit: number = DEFAULT_PAGE_LIMIT,
  cursor?: string | null,
  storeId?: string | null,
): Promise<CursorEnvelope<Transaction>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  if (storeId) {
    params.set('storeId', storeId);
  }
  return request<CursorEnvelope<Transaction>>(`/v1/customer/transactions?${params.toString()}`);
}

/** GET /v1/customer/giftcards — one page of the customer's gift cards (all states). */
export function getGiftCards(
  limit: number = DEFAULT_PAGE_LIMIT,
  cursor?: string | null,
  storeId?: string | null,
): Promise<CursorEnvelope<GiftCard>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  if (storeId) {
    params.set('storeId', storeId);
  }
  return request<CursorEnvelope<GiftCard>>(`/v1/customer/giftcards?${params.toString()}`);
}

/** POST /v1/customer/giftcards/{id}/redeem — redeem a gift card to store credit. */
export function redeemGiftCard(id: string): Promise<boolean> {
  return request<boolean>(`/v1/customer/giftcards/${encodeURIComponent(id)}/redeem`, {
    method: 'POST',
  });
}

/**
 * POST /v1/customer/giftcards/{id}/transfer — transfer a card to another resident.
 * `receiverIdentifier` is a username OR an avatar UUID; the server resolves it.
 * VALUE-MOVING and irreversible — callers must confirm before invoking.
 */
export function transferGiftCard(id: string, receiverIdentifier: string): Promise<boolean> {
  return request<boolean>(`/v1/customer/giftcards/${encodeURIComponent(id)}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ receiverIdentifier }),
  });
}

// ---------------------------------------------------------------------------
// News (kiosk feed + on-demand item requests + unread tracking).
// ---------------------------------------------------------------------------

/** GET /v1/customer/news — one page of the customer's in-scope News Kiosk posts. */
export function getNews(
  limit: number = DEFAULT_PAGE_LIMIT,
  cursor?: string | null,
  storeId?: string | null,
): Promise<CursorEnvelope<NewsPost>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  if (storeId) {
    params.set('storeId', storeId);
  }
  return request<CursorEnvelope<NewsPost>>(`/v1/customer/news?${params.toString()}`);
}

/** GET /v1/customer/news/unread — the unread badge source (one entry per in-scope store). */
export function getNewsUnread(): Promise<NewsUnread> {
  return request<NewsUnread>('/v1/customer/news/unread');
}

/**
 * POST /v1/customer/news/seen — mark posts seen. `storeId` null (the default) clears
 * ALL in-scope stores. Replies 204 No Content, so it goes through `requestNoContent`.
 */
export function markNewsSeen(storeId?: string | null): Promise<void> {
  return requestNoContent('/v1/customer/news/seen', {
    method: 'POST',
    body: JSON.stringify({ storeId: storeId ?? null }),
  });
}

/**
 * POST /v1/customer/news/{id}/request-item — request the post's on-demand item in-world.
 * The backend replies with a bare `true`; any 2xx is success, so the body is ignored.
 */
export function requestNewsItem(postId: string): Promise<void> {
  return requestNoContent(`/v1/customer/news/${encodeURIComponent(postId)}/request-item`, {
    method: 'POST',
  });
}
