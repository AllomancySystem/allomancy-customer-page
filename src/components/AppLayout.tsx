import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';
import { VIEW_ROUTES } from '@/config/viewRoutes.ts';
import { useNewsUnread } from '@/lib/useNewsUnread.ts';
import { BrandHeader } from './BrandHeader.tsx';
import { CustomerAccountSummary } from './CustomerAccountSummary.tsx';
import { CustomerAvatar } from './CustomerAvatar.tsx';

// Section routes rendered as tabs. `end` makes "/" match only the index route.
// `showsUnreadNews` marks the ONE tab that renders the unread-news count — it is
// deliberately news-specific, not a generic `badge`: any future tab badge would
// need its own count source, so it should add its own marker then.
const navItems: { to: string; label: string; end: boolean; showsUnreadNews?: true }[] = [
  { to: '/', label: 'Redelivery', end: true },
  { to: '/transactions', label: 'Transactions', end: false },
  { to: '/giftcards', label: 'Gift cards', end: false },
  { to: '/news', label: 'News', end: false, showsUnreadNews: true },
];

/**
 * App shell: a single STICKY header over the routed page (`<Outlet />`).
 *
 * Why `position: sticky` (not `fixed`): the header stays in normal document flow,
 * so the page content below needs NO manual top offset — it just scrolls beneath.
 * An opaque, blurred `bg-background` + a bottom border keep scrolled content
 * reading cleanly UNDER the header (no bleed-through), and `z-40` keeps it above
 * the content.
 *
 * The header has three deliberately TIGHT tiers so it doesn't eat short
 * mobile / in-world SL viewports:
 *   1. store logo + name (left)  ·  customer avatar (right)
 *   2. account balances (compact, always visible — not collapsed on scroll)
 *   3. section tabs
 *
 * This is a fork-and-restyle example — keep it compact and the tiers easy to
 * rearrange. (See the README "Layout" note.)
 */
export function AppLayout() {
  const navigate = useNavigate();
  // Shared 'news-unread' key — the News page clears it (mark-seen + mutate) on open.
  const { total: unreadNews } = useNewsUnread();
  const newsBadge = unreadNews > 99 ? '99+' : String(unreadNews);

  // Honor the backend's `?view={section}` deep-link intent ONCE on initial load:
  // map it via VIEW_ROUTES and replace into that route. (The token was already taken
  // from the `#ct=` fragment in main.tsx; `?view` is non-sensitive, so reading the
  // query here is fine.) Navigating to the route also drops `?view` from the address
  // bar. Absent / unmapped `view` → stay at `/`. Runs once, not on later in-app nav.
  const viewHandled = useRef(false);
  useEffect(() => {
    if (viewHandled.current) return;
    viewHandled.current = true;
    const view = new URLSearchParams(window.location.search).get('view');
    const route = view ? VIEW_ROUTES[view] : undefined;
    if (route) {
      navigate(route, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/90">
        <div className="flex flex-col gap-2 px-4 pt-2.5">
          {/* Tier 1 — store identity (left) + customer avatar (right). */}
          <div className="flex items-center justify-between gap-3">
            <BrandHeader />
            <CustomerAvatar />
          </div>

          {/* Tier 2 — store balances (always visible). */}
          <CustomerAccountSummary />

          {/* Tier 3 — section tabs: real route links, keyboard-navigable, with
              `aria-current="page"` set by NavLink on the active tab. The active
              tab's bottom border sits flush on the header's border (`-mb-px`). */}
          <nav aria-label="Sections" className="flex gap-4 ">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex shrink-0 items-center gap-1.5 rounded-t-sm border-b-2 px-1 pb-2 text-sm font-medium whitespace-nowrap transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
                {item.showsUnreadNews && unreadNews > 0 && (
                  <span
                    aria-label={`${unreadNews} unread`}
                    className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-primary-foreground"
                  >
                    {newsBadge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
