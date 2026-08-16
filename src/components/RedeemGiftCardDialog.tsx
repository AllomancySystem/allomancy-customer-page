import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { redeemGiftCard } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type GiftCard } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import { formatExpiry, isRenderableExpiry } from '../lib/creditExpiry.ts';
import { describeApiError, formatLindens } from '../lib/format.ts';

interface RedeemGiftCardDialogProps {
  card: GiftCard;
  /** Disables the trigger when the backend gate would reject a redeem. */
  disabled: boolean;
  /** Called after a confirmed, successful redeem so the list revalidates from the server. */
  onRedeemed: () => void;
}

/**
 * Confirmation step for REDEEM. Redeeming converts the card to store credit and
 * can't be undone, so it requires an explicit confirm rather than a single click.
 * Mirrors `TransferGiftCardDialog` (same AlertDialog shape, busy handling, and
 * error surfacing) — just simpler: no recipient input.
 */
export function RedeemGiftCardDialog({ card, disabled, onRedeemed }: RedeemGiftCardDialogProps) {
  const onExpired = useOnExpired();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (busy) {
      return; // don't let a mid-flight redeem be dismissed
    }
    setOpen(next);
    if (!next) {
      setError(null);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await redeemGiftCard(card.id);
      setBusy(false);
      setOpen(false);
      onRedeemed();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.kind === ApiErrorKind.Unauthorized) {
        setOpen(false);
        onExpired();
        return;
      }
      // Surface the backend ProblemDetails `detail` (already extracted by request()).
      setError(
        e instanceof ApiError ? describeApiError(e) : 'Could not redeem this gift card. Please try again.',
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" className="w-full" disabled={disabled}>
          Redeem
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redeem this gift card?</AlertDialogTitle>
          <AlertDialogDescription>
            This adds {formatLindens(card.credit)} to your store credit and can't be undone.
            {isRenderableExpiry(card.expiresAt)
              ? ` Its credit will expire on ${formatExpiry(new Date(card.expiresAt))} no matter when you redeem.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={busy} aria-busy={busy}>
            {busy ? 'Redeeming…' : 'Redeem'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
