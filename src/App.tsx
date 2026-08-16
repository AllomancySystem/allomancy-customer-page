import { useCallback, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { hasToken } from './auth/token.ts';
import { ExpiredContext } from './app/expired.ts';
import { AppLayout } from './components/AppLayout.tsx';
import { BrandHeader } from './components/BrandHeader.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';
import { GiftCardsPage } from './pages/GiftCardsPage.tsx';
import { NewsPage } from './pages/NewsPage.tsx';
import { RedeliveryPage } from './pages/RedeliveryPage.tsx';
import { TransactionsPage } from './pages/TransactionsPage.tsx';

/** Minimal branded frame for the app-wide terminal gate screens (no nav). */
function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 pb-12">
      <BrandHeader />
      <main>{children}</main>
    </div>
  );
}

/**
 * Root. The token was already captured once (in `main.tsx`, before this renders),
 * so here we only gate: a terminal "expired" screen (any route can trigger it via
 * `ExpiredContext`), the "no token" screen, or — when authenticated — the router.
 *
 * Order matters: a 401 clears the token in the frozen `request()`, so `expired`
 * must be checked BEFORE `hasToken()` or a freshly-expired link would fall through
 * to the "no token" screen instead of the "expired" one.
 */
export default function App() {
  const [expired, setExpired] = useState(false);
  const handleExpired = useCallback(() => setExpired(true), []);

  if (expired) {
    return (
      <GateFrame>
        <StatusScreen title="Your link has expired">
          <p>Please request a new redelivery link from the store.</p>
        </StatusScreen>
      </GateFrame>
    );
  }

  if (!hasToken()) {
    return (
      <GateFrame>
        <StatusScreen title="Open this page from the inworld link">
          <p>
            This page opens from a personal link sent to you in-world by local chat message. Please use that
            link to see your products, transactions, and gift cards.
          </p>
        </StatusScreen>
      </GateFrame>
    );
  }

  return (
    <ExpiredContext.Provider value={handleExpired}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RedeliveryPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="giftcards" element={<GiftCardsPage />} />
          <Route path="news" element={<NewsPage />} />
          {/* Unknown in-app path → home (deep links still need an SPA host fallback). */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ExpiredContext.Provider>
  );
}
