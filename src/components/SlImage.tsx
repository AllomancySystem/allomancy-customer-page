import { useState } from 'react';
import {
  isRenderableUuid,
  NO_IMAGE_URL,
  slImageSrcSet,
  slImageUrl,
  type SlImageKind,
} from '../lib/slImage.ts';

interface SlImageProps {
  /** SL texture UUID (or null/empty/zero → fallback). */
  uuid: string | null;
  kind: SlImageKind;
  alt: string;
  /** Base width to request (the `1x` of the srcset). */
  width: number;
  className?: string;
  /** `sizes` attribute to help the browser pick from the srcset. */
  sizes?: string;
}

/**
 * Presentational SL texture <img>: responsive srcset + graceful fallback. A
 * missing UUID renders the fallback directly (no broken request); an <img>
 * load error swaps to the fallback once.
 */
export function SlImage({ uuid, kind, alt, width, className, sizes }: SlImageProps) {
  const [errored, setErrored] = useState(false);
  const renderable = isRenderableUuid(uuid) && !errored;

  if (!renderable) {
    return (
      <img
        className={className}
        src={NO_IMAGE_URL}
        alt={alt}
        width={width}
        height={width}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <img
      className={className}
      src={slImageUrl(kind, uuid, width)}
      srcSet={slImageSrcSet(kind, uuid)}
      sizes={sizes}
      alt={alt}
      width={width}
      height={width}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
    />
  );
}
