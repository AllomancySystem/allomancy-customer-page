import { useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { transferGiftCard } from '../api/customerClient.ts';
import { ApiError, ApiErrorKind, type GiftCard } from '../api/types.ts';
import { useOnExpired } from '../app/expired.ts';
import { describeApiError, formatLindens } from '../lib/format.ts';

interface TransferGiftCardDialogProps {
  card: GiftCard;
  /** Disables the trigger when the backend gate would reject a transfer. */
  disabled: boolean;
  /** Called after a confirmed, successful transfer so the list revalidates from the server. */
  onTransferred: () => void;
}

/**
 * VALUE-MOVING action. A transfer is irreversible, so it requires an explicit
 * confirmation step (this AlertDialog) showing the card + the entered recipient —
 * never a one-click transfer. The recipient is a username OR an avatar UUID; the
 * server resolves it, so we only require a non-empty, trimmed value.
 */
export function TransferGiftCardDialog({ card, disabled, onTransferred }: TransferGiftCardDialogProps) {
  const onExpired = useOnExpired();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (busy) {
      return; // don't let a mid-flight transfer be dismissed
    }
    setOpen(next);
    if (!next) {
      setRecipient('');
      setError(null);
    }
  }

  async function handleConfirm() {
    const identifier = recipient.trim();
    if (identifier === '') {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await transferGiftCard(card.id, identifier);
      setBusy(false);
      setOpen(false);
      onTransferred();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.kind === ApiErrorKind.Unauthorized) {
        setOpen(false);
        onExpired();
        return;
      }
      // Surface the backend ProblemDetails `detail` (already extracted by request()).
      setError(
        e instanceof ApiError ? describeApiError(e) : 'Could not transfer this gift card. Please try again.',
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full" disabled={disabled}>
          Transfer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer this gift card?</AlertDialogTitle>
          <AlertDialogDescription>
            This sends your {formatLindens(card.credit)} gift card to another resident. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-medium">
            Recipient username
          </label>
          <Input
            id={inputId}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="username"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || recipient.trim() === ''}
            aria-busy={busy}
          >
            {busy ? 'Transferring…' : 'Transfer'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
