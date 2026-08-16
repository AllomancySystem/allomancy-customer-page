// Pure text helpers for rendering a News post body. No React state, no DOM, no
// side effects — so they're trivially testable and safe to reuse.

import { createElement, type ReactNode } from 'react';

/** Title-case one word ("doe" → "Doe", "" → ""). Total over any input. */
function capitalize(word: string): string {
  return word.length === 0 ? '' : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * The full display name from an SL username — mirrors the legacy `formatUsername`:
 * split on whitespace/dots, title-case each part, rejoin with spaces
 * ("john.doe" → "John Doe"). Empty in → empty out.
 */
function formatFullName(username: string): string {
  return username
    .split(/[\s.]+/)
    .map(capitalize)
    .join(' ')
    .trim();
}

/**
 * The first name from an SL username — mirrors the legacy `GetFirstName`: the part
 * before the first dot, title-cased ("john.doe" → "John"). Empty in → empty out.
 */
function firstName(username: string): string {
  return capitalize(username.split('.')[0] ?? '');
}

/**
 * Substitute the News-post placeholders per viewer: `{username}` → the viewer's full
 * display name, `{name}` → their first name. Both are replaced globally. Total: an
 * empty username yields empty substitutions rather than throwing.
 */
export function substitutePlaceholders(message: string, username: string): string {
  return message.replaceAll('{username}', formatFullName(username)).replaceAll('{name}', firstName(username));
}

// A conservative single-pass matcher: an http/https URL, OR an email address. We
// deliberately keep it simple (no bare "www." or scheme-less hosts) so we never
// mis-link ordinary prose; trailing sentence punctuation is trimmed off the match
// below so "see https://x.com." doesn't swallow the period into the link.
const LINK_PATTERN = /(https?:\/\/[^\s<]+)|([^\s<@]+@[^\s<@]+\.[a-zA-Z]{2,})/g;
const TRAILING_PUNCTUATION = /[.,:;!?)\]}'"]+$/;

const LINK_CLASS = 'font-medium text-primary underline underline-offset-4 break-words hover:text-foreground';

/**
 * Split plain text into React nodes, turning URLs and emails into real `<a>`
 * elements (never `dangerouslySetInnerHTML`). Everything else stays literal text,
 * so a message with no links returns a single-string array. Links open in a new tab
 * with `rel="noopener noreferrer"`. Keys are stable within a single message render.
 */
export function linkifyToReact(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    // Trim trailing punctuation back out to plain text (a URL rarely ends in one).
    let token = match[0];
    const trailing = token.match(TRAILING_PUNCTUATION)?.[0] ?? '';
    if (trailing) {
      token = token.slice(0, token.length - trailing.length);
    }

    const isEmail = match[2] !== undefined;
    const href = isEmail ? `mailto:${token}` : token;
    nodes.push(
      createElement(
        'a',
        { key: `link-${key++}`, href, target: '_blank', rel: 'noopener noreferrer', className: LINK_CLASS },
        token,
      ),
    );
    if (trailing) {
      nodes.push(trailing);
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
