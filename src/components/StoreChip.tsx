import type { StoreRef } from '../api/types.ts';
import { SlImage } from './SlImage.tsx';

/**
 * Compact store attribution (small logo + name) that labels an item with its owning
 * store on the collective page. Render only when the page is a collective; a
 * single-store page shows no chip, so it stays identical to the pre-collective UI.
 */
export function StoreChip({ store }: { store: StoreRef | undefined }) {
  if (!store) {
    return null;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <SlImage
        uuid={store.logo}
        kind="sl"
        alt=""
        width={64}
        className="size-4 shrink-0 rounded-sm object-cover"
      />
      <span className="truncate">{store.name}</span>
    </span>
  );
}
