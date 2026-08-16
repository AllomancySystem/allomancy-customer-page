// SL texture rendering — swap these two URL builders to change CDN/proxy.
//
// Backend gives us raw Second Life texture UUIDs (not URLs). We render them via
// the slimg.allomancy.net image proxy, which serves the nearest pre-baked size
// variant (256, 512, or the full master) directly. A requested width is snapped
// up to the smallest tier that covers it; a width above the largest variant gets
// the full master (no `?w`). A null / empty / all-zero UUID renders the fallback
// instead of a broken request.

const IMAGE_BASE = 'https://slimg.allomancy.net';

/** Fallback shown for missing textures or <img> load errors. */
export const NO_IMAGE_URL = 'https://vessel.allomancy.net/noimage.webp';

/**
 * The variant tiers the proxy serves (the full master is requested separately
 * with no `?w`). Kept in sync with the slimg.allomancy.net worker's tier ladder.
 */
export const WIDTH_LADDER = [256, 512] as const;

// The full master carries no `?w`; advertised at SL's 2048 max-edge so the
// browser treats it as the top responsive candidate.
const FULL_MASTER_DESCRIPTOR = 2048;

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/** A UUID is renderable when it is non-empty and not the all-zero GUID. */
export function isRenderableUuid(uuid: string | null | undefined): uuid is string {
  return !!uuid && uuid !== ZERO_UUID;
}

/** The two texture "kinds" the proxy exposes. */
export type SlImageKind = 'sl' | 'profile';

/** Snap a requested display width to the proxy's tier query, or '' for the full master. */
function tierQuery(width: number): string {
  if (width <= 256) return '?w=256';
  if (width <= 512) return '?w=512';
  return '';
}

/** Single URL snapped to the nearest tier that covers the requested width. */
export function slImageUrl(kind: SlImageKind, uuid: string, width: number): string {
  return `${IMAGE_BASE}/${kind}/${uuid}${tierQuery(width)}`;
}

/** A responsive `srcset`: the variant tiers plus the full-master candidate. */
export function slImageSrcSet(kind: SlImageKind, uuid: string): string {
  const candidates = WIDTH_LADDER.map((w) => `${IMAGE_BASE}/${kind}/${uuid}?w=${w} ${w}w`);
  candidates.push(`${IMAGE_BASE}/${kind}/${uuid} ${FULL_MASTER_DESCRIPTOR}w`);
  return candidates.join(', ');
}
