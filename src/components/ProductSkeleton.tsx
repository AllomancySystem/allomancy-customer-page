import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder grid shown while the first page of products is fetched. */
export function ProductSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] sm:gap-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <Card className="h-full gap-0 py-0">
            <Skeleton className="aspect-square rounded-none" />
            <CardContent className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
