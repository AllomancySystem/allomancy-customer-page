// Presentation formatters shared across the pages. Pure, no side effects.

import { ApiErrorKind, type ApiError } from '../api/types.ts';

/** Linden-dollar amount, e.g. `L$ 1,250`. The currency symbol is always `L$`. */
export function formatLindens(amount: number): string {
  return `L$ ${amount.toLocaleString()}`;
}

/** ISO-8601 UTC timestamp → the viewer's locale date+time (falls back to the raw string). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** Human-readable text for a non-auth ApiError (401s are handled app-wide, not here). */
export function describeApiError(error: ApiError): string {
  if (error.kind === ApiErrorKind.RateLimited) {
    return error.retryAfterSeconds
      ? `Too many requests. Please wait about ${error.retryAfterSeconds}s and try again.`
      : error.message;
  }
  return error.message;
}
