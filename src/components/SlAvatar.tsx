import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  isRenderableUuid,
  NO_IMAGE_URL,
  slImageSrcSet,
  slImageUrl,
  type SlImageKind,
} from '../lib/slImage.ts';

interface SlAvatarProps {
  /** SL texture UUID (or null/empty/zero → fallback image). */
  uuid: string | null;
  kind: SlImageKind;
  /** Accessible label; pass '' when an adjacent visible text label exists. */
  alt: string;
  /** Layout-only classes (e.g. `size-12`). */
  className?: string;
}

/**
 * A Second Life texture rendered as a shadcn `Avatar`. The image URL comes from
 * the frozen `slImage` builder; `AvatarFallback` shows the neutral placeholder
 * image when the UUID is missing/zero or the texture fails to load — keeping the
 * same graceful fallback the rest of the page uses.
 */
export function SlAvatar({ uuid, kind, alt, className }: SlAvatarProps) {
  return (
    <Avatar className={className}>
      {isRenderableUuid(uuid) && (
        <AvatarImage
          src={slImageUrl(kind, uuid, 96)}
          srcSet={slImageSrcSet(kind, uuid)}
          alt={alt}
        />
      )}
      <AvatarFallback>
        <img src={NO_IMAGE_URL} alt={alt} className="size-full object-cover" />
      </AvatarFallback>
    </Avatar>
  );
}
