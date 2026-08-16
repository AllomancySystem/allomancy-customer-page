// ============================================================================
// SECURITY CORE — customer-token handling. Do NOT casually edit.
// ============================================================================
//
// The customer token is an opaque, short-lived bearer credential. It arrives in
// the URL *fragment* (`{origin}/#ct={token}`) on purpose: fragments are never
// sent to any server nor placed in the `Referer` header, so the token cannot
// leak into request logs.
//
// Invariants enforced here (and ONLY here):
//   1. On load, read the `ct` value from `location.hash`, store the RAW token in
//      `sessionStorage` (NOT localStorage — it must die with the tab), then
//      immediately scrub the fragment from the address bar so it can't be
//      shoulder-surfed or bookmarked.
//   2. Every subsequent read comes from `sessionStorage`.
//   3. The raw token value is NEVER logged.
//
// If you change anything in this file, you are changing the security model.
// ============================================================================

const STORAGE_KEY = 'allomancy.customerToken';
const FRAGMENT_PARAM = 'ct';

/**
 * Read the token from the URL fragment (if present), persist it to
 * sessionStorage, and scrub the fragment from the address bar. Idempotent and
 * safe to call once on app start. No-op when there is no `#ct=` fragment.
 */
export function captureTokenFromFragment(): void {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) {
    return;
  }

  // hash is like "#ct=<token>"; strip the leading '#' before parsing.
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get(FRAGMENT_PARAM);
  if (!token) {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, token);

  // Scrub the fragment so the raw token is no longer in the visible URL / history.
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
}

/** The raw token for the current tab/session, or null if none is held. */
export function getToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

/** True when a token is held for this session. */
export function hasToken(): boolean {
  return getToken() !== null;
}

/** Forget the token (call on 401 — the link is dead). */
export function clearToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
