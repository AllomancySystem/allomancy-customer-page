import { describe, it, expect } from 'vitest';

import { ApiError, ApiErrorKind } from '../api/types';
import { describeApiError } from './format';
import { requestItemErrorMessage, NEWS_SUBSCRIBE_HINT } from './newsRequestError';

describe('requestItemErrorMessage', () => {
  it('maps code=news_subscription_required (Problem 400) to the subscribe hint', () => {
    const error = new ApiError(ApiErrorKind.Problem, 'Subscription required', {
      status: 400,
      code: 'news_subscription_required',
    });
    expect(requestItemErrorMessage(error)).toBe(NEWS_SUBSCRIBE_HINT);
  });

  it('maps code=news_item_not_available (400) to the item-unavailable copy', () => {
    const error = new ApiError(ApiErrorKind.Problem, 'Item gone', {
      status: 400,
      code: 'news_item_not_available',
    });
    expect(requestItemErrorMessage(error)).toBe('This item is no longer available.');
  });

  it('reads code BEFORE status: subscription code + 404 still returns the subscribe hint', () => {
    const error = new ApiError(ApiErrorKind.Problem, 'Subscription required', {
      status: 404,
      code: 'news_subscription_required',
    });
    expect(requestItemErrorMessage(error)).toBe(NEWS_SUBSCRIBE_HINT);
  });

  it('maps a 404 with no recognized code to the post-gone copy', () => {
    const error = new ApiError(ApiErrorKind.Problem, 'Not found', { status: 404 });
    expect(requestItemErrorMessage(error)).toBe('This post is no longer available.');
  });

  it('maps a RateLimited error (429, no code) to the try-again-in-a-moment copy', () => {
    const error = new ApiError(ApiErrorKind.RateLimited, 'Slow down', { status: 429 });
    expect(requestItemErrorMessage(error)).toBe('Please try again in a moment.');
  });

  it('falls back to describeApiError for a generic ApiError (Problem, no code, 500)', () => {
    const error = new ApiError(ApiErrorKind.Problem, 'Something broke', { status: 500 });
    expect(requestItemErrorMessage(error)).toBe(describeApiError(error));
    // For a non-rate-limited kind, describeApiError is just error.message.
    expect(requestItemErrorMessage(error)).toBe('Something broke');
  });

  it('maps a non-ApiError value to the generic request-failed copy', () => {
    expect(requestItemErrorMessage(new Error('boom'))).toBe(
      'Could not request this item. Please try again.',
    );
    expect(requestItemErrorMessage('boom')).toBe(
      'Could not request this item. Please try again.',
    );
    expect(requestItemErrorMessage(undefined)).toBe(
      'Could not request this item. Please try again.',
    );
  });

  it('NEWS_SUBSCRIBE_HINT is the exact frozen contract-facing copy', () => {
    expect(NEWS_SUBSCRIBE_HINT).toBe(
      "Subscribe at this store's News Kiosk inworld to receive items",
    );
  });
});
