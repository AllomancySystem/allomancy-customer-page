// Deep-link section → route map.
//
// The backend sends customer-page links as `{origin}/?view={section}#ct={token}`.
// On load the app navigates to the route this map gives for `view` (see AppLayout);
// an absent or unmapped `view` stays at `/`. The token is separate — it rides the
// `#ct=` fragment and is handled by the frozen `auth/token.ts`.
//
// If you rename or restructure your routes, edit ONLY this map (keep the keys equal
// to the `view` values the backend sends).
export const VIEW_ROUTES: Record<string, string> = {
  giftcards: '/giftcards',
  transactions: '/transactions',
  news: '/news',
};
