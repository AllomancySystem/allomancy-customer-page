import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GiftCard } from '../api/types.ts';
import { UrgencyTier, formatExpiry, isRenderableExpiry, urgencyTier } from '../lib/creditExpiry.ts';
import { formatLindens } from '../lib/format.ts';
import { isRenderableUuid } from '../lib/slImage.ts';
import { useStore } from '../lib/useStore.ts';
import { ClockIcon } from './icons/ClockIcon.tsx';
import { RedeemGiftCardDialog } from './RedeemGiftCardDialog.tsx';
import { SlImage } from './SlImage.tsx';
import { StoreChip } from './StoreChip.tsx';
import { TransferGiftCardDialog } from './TransferGiftCardDialog.tsx';

interface GiftCardCardProps {
  card: GiftCard;
  /** Revalidate the list from the server after a successful redeem or transfer. */
  onChanged: () => void;
}

export function GiftCardCard({ card, onChanged }: GiftCardCardProps) {
  const { storesById, isCollective } = useStore();

  // Mirror the backend gate EXACTLY: never offer an action the server will reject.
  // The dialogs are a confirm layer on top; they do not change this gating.
  const canRedeem = card.active && !card.redeemed && card.credit > 0;
  const canTransfer = card.active && !card.redeemed && card.credit > 0 && card.transfer;

  // Expiry (CP2): render the date + urgency chip only for a PARSEABLE expiresAt string
  // (a truthy-but-unparseable value would crash `formatExpiry` — CP8 fail-soft).
  const expiryDate = isRenderableExpiry(card.expiresAt) ? new Date(card.expiresAt) : null;
  const expiryTier = expiryDate ? urgencyTier(expiryDate, new Date()) : UrgencyTier.None;

  const store = storesById[card.storeId];
  // The card's own texture, else its store's logo (resolved via storeId), else
  // nothing. Mirrors customers-allomancy (texture, then store logo); when neither is
  // a real UUID the image is hidden entirely rather than showing a placeholder.
  const storeLogo = store?.logo ?? null;
  const imageUuid = isRenderableUuid(card.texture)
    ? card.texture
    : isRenderableUuid(storeLogo)
      ? storeLogo
      : null;

  return (
    <li>
      <Card className="h-full gap-0 overflow-hidden py-0">
        {imageUuid && (
          <div className="aspect-square bg-muted">
            <SlImage
              uuid={imageUuid}
              kind="sl"
              alt=""
              width={512}
              sizes="(max-width: 640px) 45vw, 240px"
              className="size-full object-cover"
            />
          </div>
        )}
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold">{formatLindens(card.credit)}</span>
            {/* Provenance label only; does NOT gate any action. */}
            <Badge variant="outline" className="w-fit">
              {card.purchased ? 'Purchased' : 'Gift'}
            </Badge>
          </div>

          {expiryDate && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Expires{' '}
                <time dateTime={card.expiresAt ?? undefined} className="font-medium text-foreground">
                  {formatExpiry(expiryDate)}
                </time>
              </p>
              {expiryTier !== UrgencyTier.None && (
                <Badge
                  variant={expiryTier === UrgencyTier.Danger ? 'destructive' : 'outline'}
                  className={cn(
                    'gap-1',
                    expiryTier === UrgencyTier.Warn &&
                      'border-amber-500 text-amber-600 dark:text-amber-400',
                  )}
                >
                  <ClockIcon />
                  Expires soon
                </Badge>
              )}
            </div>
          )}

          {/* Owning-store attribution, collectives only (single-store shows nothing). */}
          {isCollective && <StoreChip store={store} />}

          {!card.redeemed && (
            <div className="mt-auto flex flex-col gap-2">
              {/* Both value-moving actions confirm via an AlertDialog before executing. */}
              <RedeemGiftCardDialog card={card} disabled={!canRedeem} onRedeemed={onChanged} />
              {/* transfer === false hides the Transfer button entirely (Redeem only). */}
              {card.transfer && (
                <TransferGiftCardDialog card={card} disabled={!canTransfer} onTransferred={onChanged} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
