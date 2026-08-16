import type { RedeliverableProduct } from '../api/types.ts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useStore } from '../lib/useStore.ts';
import { SlImage } from './SlImage.tsx';
import { StoreChip } from './StoreChip.tsx';

/** Per-product redelivery state, owned by the page. */
export type RedeliveryStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'success' }
  | { state: 'error'; message: string };

interface ProductCardProps {
  product: RedeliverableProduct;
  status: RedeliveryStatus;
  onRequest: (productId: string) => void;
}

/** Thin presentational card: image, name, and a redelivery button + feedback. */
export function ProductCard({ product, status, onRequest }: ProductCardProps) {
  const { storesById, isCollective } = useStore();
  const pending = status.state === 'pending';
  const succeeded = status.state === 'success';

  return (
    <li>
      <Card className="h-full gap-0 py-0">
        <div className="aspect-square bg-muted">
          <SlImage
            uuid={product.image}
            kind="sl"
            alt={product.name}
            width={512}
            sizes="(max-width: 640px) 45vw, 240px"
            className="size-full object-cover"
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <CardTitle>{product.name}</CardTitle>
          {/* Owning-store attribution, collectives only (single-store shows nothing). */}
          {isCollective && <StoreChip store={storesById[product.storeId]} />}

          {succeeded ? (
            <p
              role="status"
              className="mt-auto rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground"
            >
              Sent! Check in-world for your delivery.
            </p>
          ) : (
            <Button
              type="button"
              size="lg"
              className="mt-auto w-full"
              onClick={() => onRequest(product.id)}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? 'Sending…' : 'Request redelivery'}
            </Button>
          )}

          {status.state === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
