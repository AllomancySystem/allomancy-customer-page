// Maps a failed "Get item" request to user-facing copy. Pure and side-effect-free
// so the vocabulary can be unit-tested without a network. 401 is NOT handled here —
// the caller intercepts it (session expiry) before this runs.

import { ApiError, ApiErrorKind } from '../api/types.ts';
import { describeApiError } from './format.ts';

/**
 * The subscription-lapsed hint, shared with NewsCard's disabled-button copy so the
 * string lives in exactly one place. Matches the `news_subscription_required` message.
 */
export const NEWS_SUBSCRIBE_HINT = "Subscribe at this store's News Kiosk inworld to receive items";

/**
 * User message for a request-item failure. Reads the ProblemDetails `code` first,
 * then falls back to the HTTP `status`, then to a generic message. Confirmed frozen
 * vocabulary; anything unmapped keeps the generic fallback.
 */
export function requestItemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'news_subscription_required') {
      return NEWS_SUBSCRIBE_HINT;
    }
    if (error.code === 'news_item_not_available') {
      return 'This item is no longer available.';
    }
    if (error.status === 404) {
      return 'This post is no longer available.';
    }
    if (error.kind === ApiErrorKind.RateLimited) {
      return 'Please try again in a moment.';
    }
    return describeApiError(error);
  }
  return 'Could not request this item. Please try again.';
}
