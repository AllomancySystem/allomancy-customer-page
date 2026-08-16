import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ApiError } from '../api/types.ts';
import { describeApiError } from '../lib/format.ts';

interface ListControlsProps {
  error: ApiError | null;
  nextCursor: string | null;
  loading: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}

/**
 * Footer for a paginated list once the first page has loaded: a "load more"
 * button and an inline error (with retry) for a failed subsequent fetch. The
 * initial-load error is a full-page state, handled by the page, not here.
 */
export function ListControls({ error, nextCursor, loading, onRetry, onLoadMore }: ListControlsProps) {
  if (error) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertTitle>Couldn't load more</AlertTitle>
          <AlertDescription>{describeApiError(error)}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" className="self-center" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (nextCursor) {
    return (
      <div className="mt-6 flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onLoadMore}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      </div>
    );
  }

  return null;
}
