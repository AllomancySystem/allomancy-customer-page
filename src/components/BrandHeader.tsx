import { Skeleton } from '@/components/ui/skeleton';
import { useStore } from '@/lib/useStore.ts';
import { SlImage } from './SlImage.tsx';

/**
 * Brand identity for the top-left of the header: a rounded-rectangle logo and the
 * brand name. Both come from the customer's store context (fetched via `useStore`),
 * so there is nothing to hardcode in this template. The logo is an SL texture UUID
 * rendered through the frozen `slImage` proxy (`/sl/{uuid}`, a null or zero UUID
 * falls back) as a plain <img> rectangle, not the circular avatar. `min-w-0` +
 * `truncate` keep a long name from pushing the customer avatar off the row.
 */
export function BrandHeader() {
  const { brand, loading } = useStore();

  // Graceful load state: reserve the logo + name slots so the row does not shift.
  if (loading) {
    return (
      <div className="flex min-w-0 items-center gap-3" aria-hidden="true">
        <Skeleton className="size-12 shrink-0 rounded-lg sm:size-14" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  // Fetch failed or the context endpoint is not available: fall back to a neutral
  // logo (the slImage placeholder) with no name, rather than a permanent skeleton.
  if (!brand) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <SlImage
          uuid={null}
          kind="sl"
          alt=""
          width={112}
          className="size-12 shrink-0 rounded-lg object-cover sm:size-14"
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <SlImage
        uuid={brand.logo}
        kind="sl"
        alt=""
        width={112}
        className="size-12 shrink-0 rounded-lg object-cover sm:size-14"
      />
      <span className="truncate font-heading text-base font-semibold tracking-tight sm:text-lg">
        {brand.name}
      </span>
    </div>
  );
}
