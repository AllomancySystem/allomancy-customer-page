import { cn } from '@/lib/utils.ts';
import type { StoreRef } from '../api/types.ts';

interface StoreFilterProps {
  stores: StoreRef[];
  /** The selected store id, or null for "All stores". */
  value: string | null;
  onChange: (storeId: string | null) => void;
  /**
   * Optional per-store unread counts, keyed by store id. When provided, a store with
   * a count > 0 shows a small dot on its pill. Undefined (the default) renders exactly
   * as before, so callers that don't pass it are unaffected.
   */
  unreadByStore?: Record<string, number>;
}

/**
 * Store filter for a collective list ("All stores" plus one pill per member store).
 * Applied SERVER-SIDE (the selected id is passed to the list endpoint as `?storeId=`),
 * so it stays correct across cursor pages. Rendered only for collectives.
 */
export function StoreFilter({ stores, value, onChange, unreadByStore }: StoreFilterProps) {
  const options: { id: string | null; label: string }[] = [
    { id: null, label: 'All stores' },
    ...stores.map((s) => ({ id: s.id, label: s.name })),
  ];
  return (
    <div role="tablist" aria-label="Filter by store" className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.id;
        const hasUnread = option.id != null && (unreadByStore?.[option.id] ?? 0) > 0;
        return (
          <button
            key={option.id ?? '__all__'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {hasUnread && (
              <span
                aria-label="unread news"
                className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
