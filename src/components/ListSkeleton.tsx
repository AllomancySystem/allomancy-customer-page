import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Vertical loading placeholder for the transactions list. */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        </li>
      ))}
    </ul>
  );
}
