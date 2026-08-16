import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils.ts';
import { requestNewsItem } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type NewsPost } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import { formatDateTime } from '../lib/format.ts';
import { linkifyToReact, substitutePlaceholders } from '../lib/newsMessage.ts';
import { NEWS_SUBSCRIBE_HINT, requestItemErrorMessage } from '../lib/newsRequestError.ts';
import { useStore } from '../lib/useStore.ts';
import { StoreChip } from './StoreChip.tsx';

/** Per-card "Get item" request state (local — one post's button owns its own feedback). */
type RequestStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'success' }
  | { state: 'error'; message: string };

/** Keep the button disabled briefly after a success so a double-tap can't re-request. */
const SUCCESS_COOLDOWN_MS = 4000;

/**
 * One News Kiosk post. Presentational: the viewer's username is passed in (the page
 * owns the shared profile fetch) so the card just substitutes placeholders and
 * linkifies the body. When the post carries an on-demand item, it exposes a "Get item"
 * request with inline per-card feedback (no toasts), gated by the server-computed
 * `canRequestItem`.
 */
export function NewsCard({ post, username }: { post: NewsPost; username: string }) {
  const { storesById, isCollective } = useStore();
  const onExpired = useOnExpired();

  const message = substitutePlaceholders(post.message, username);

  // Collapse long posts to two lines; reveal a toggle only when the body actually
  // overflows the clamp (measured), so short posts show no affordance.
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (expanded) return;
    const el = messageRef.current;
    if (el) {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    }
  }, [message, expanded]);

  const [status, setStatus] = useState<RequestStatus>({ state: 'idle' });
  const cooldownRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (cooldownRef.current !== null) {
        window.clearTimeout(cooldownRef.current);
      }
    },
    [],
  );

  const handleRequest = useCallback(async () => {
    setStatus({ state: 'pending' });
    try {
      await requestNewsItem(post.id);
      setStatus({ state: 'success' });
      cooldownRef.current = window.setTimeout(() => setStatus({ state: 'idle' }), SUCCESS_COOLDOWN_MS);
    } catch (error) {
      if (error instanceof ApiError && error.kind === ApiErrorKind.Unauthorized) {
        onExpired();
        return;
      }
      setStatus({ state: 'error', message: requestItemErrorMessage(error) });
    }
  }, [post.id, onExpired]);

  // Only on-demand items get the request affordance; the server pre-computes eligibility.
  const showGetItem = post.item != null && post.onDemandItem;
  const pending = status.state === 'pending';
  const cooling = status.state === 'success';
  const subscribeHint = NEWS_SUBSCRIBE_HINT;

  return (
    <Card className="gap-3 p-4">
      <p ref={messageRef} className={cn('text-sm whitespace-pre-wrap', !expanded && 'line-clamp-2')}>
        {linkifyToReact(message)}
      </p>

      {(overflowing || expanded) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto self-start p-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {isCollective && <StoreChip store={storesById[post.storeId]} />}
        <span>{formatDateTime(post.created)}</span>
      </div>

      {showGetItem && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{post.item}</p>
          <Button
            type="button"
            className="self-start"
            onClick={handleRequest}
            disabled={!post.canRequestItem || pending || cooling}
            aria-busy={pending}
            aria-label={post.canRequestItem ? undefined : subscribeHint}
            title={post.canRequestItem ? undefined : subscribeHint}
          >
            {pending ? 'Requesting…' : 'Get item'}
          </Button>

          {!post.canRequestItem && <p className="text-xs text-muted-foreground">{subscribeHint}.</p>}

          {status.state === 'success' && (
            <p role="status" className="text-sm text-foreground">
              Item requested. You will receive it inworld!
            </p>
          )}

          {status.state === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
