import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils.ts';

interface StatusScreenProps {
  title: string;
  children?: ReactNode;
  /** Optional call-to-action (e.g. a retry button). */
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'error';
}

/** Centered status message (shadcn `Empty`) for no-token / expired / error / empty states. */
export function StatusScreen({ title, children, action, tone = 'neutral' }: StatusScreenProps) {
  return (
    <Empty
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mx-auto my-12 max-w-md border',
        tone === 'error' && 'border-destructive/40',
      )}
    >
      <EmptyHeader>
        <EmptyTitle className={cn('text-base', tone === 'error' && 'text-destructive')}>
          {title}
        </EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button type="button" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
