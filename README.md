# Your Store: Customer Redelivery Page

A **fork-and-deploy template** for your own branded customer page on the
[Allomancy](https://allomancy.com) vending platform. Customers open a
personal link (`https://your-domain/#ct=…`) and can request redeliveries, see
their transaction history, and manage gift cards. **The backend is already wired
in, so there is no API setup or `.env` to configure.** Just deploy it, point your
store at it, and (optionally) rebrand it.

It's a plain static SPA (Vite + React + TypeScript), so it runs on any static
host.

---

## 1. Deploy (Cloudflare)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AllomancySystem/allomancy-customer-page)

One click clones this template to your GitHub, then provisions and deploys it as a
Cloudflare Worker with static assets (the repo must be public). Prefer to set it up
by hand? The steps below work too.

Cloudflare is free, gives automatic HTTPS, and serves this SPA directly. The repo
ships a `wrangler.jsonc` (Workers Static Assets config) and a `.node-version`, so
the CLI, the dashboard, and the button all auto-detect the build. (Any static host
works; see the note at the end.)

**Option A, connect your repo (auto-deploys on every push):** in the
[Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** →
**Create** → **Import a repository**, pick your repo, and set the build command to
`pnpm build`. Cloudflare builds it and serves it at a `*.workers.dev` URL.

**Option B, deploy from your machine:**

```bash
pnpm install
pnpm build
pnpm dlx wrangler deploy
```

**SPA routing is already handled** by the `wrangler.jsonc` setting
`assets.not_found_handling: "single-page-application"`, which serves `index.html`
for unknown paths so deep links and refreshes on `/transactions` / `/giftcards`
work. No `_redirects` file is needed.

Your page is served over HTTPS at the URL Cloudflare assigns, and that URL works
as-is.

> Any static host works (S3 + CloudFront, nginx, GitHub Pages); it's a plain
> static `dist/`. Just make sure the host serves `index.html` for unknown paths
> (the SPA fallback above).

---

## 2. Connect it in Allomancy Stores

Tell your store to hand out links on your deployed page:

1. Go to **[stores.allomancy.com](https://stores.allomancy.com)** → **Settings**
   → **Customer Page**.
2. Set the **Customer Page Origin** to your deployed page's URL
   (your `*.workers.dev` URL or your custom domain; it must be `https://` with no
   path).
3. Save.

Until you set this, your customers keep using the default
`customer.allomancy.com` page. The origin you set is also what the backend allows
to call it, so it must match your deployed page's URL exactly.

**That's all the setup the common case needs.** Once the origin is set, the
redelivery and gift-card links Allomancy sends your customers in-world automatically
point at your domain, with the per-customer token minted server-side. There is
nothing else to configure.

---

## Optional: minting customer links from your own integration

You do NOT need this for the common case: once the origin is set (above), Allomancy
mints the in-world redelivery and gift-card links for you. This is only for a
merchant who wants to generate customer links programmatically from their **own**
server-side integration.

1. At **[stores.allomancy.com](https://stores.allomancy.com)** → **Integrations**
   → **API Keys** → **Create API Key** with the **Customer Tokens (mint)** scope
   (`customertokens:mint`).
2. From your server, `POST /v1/customer-tokens` with that key and a JSON body naming
   the customer (their Second Life username or avatar UUID) to mint a per-customer
   token:

   ```bash
   curl --fail-with-body https://integrations.allomancy.net/v1/customer-tokens \
     -H "X-API-Key: <your-key>" \
     -H "Content-Type: application/json" \
     -d '{ "customerIdentifier": "resident.username" }'
   ```

   The response carries the token, a ready-to-use link, and its expiry:

   ```json
   {
     "token": "…",
     "url": "https://your-origin/#ct=…",
     "expiresAt": "2026-07-08T12:00:00Z"
   }
   ```

   Hand the customer the `url` as-is, or build it yourself as `{your-origin}/#ct={token}`
   (add `?view={section}` before the `#ct=` fragment to deep-link to a tab; see Deep
   links below).

   To scope the token to a **collective** instead of your own store, add its
   `collectiveId` to the same request. Only the collective's owner store can mint this
   way, and only for a customer of your store; the returned `url` then points at the
   collective's customer page:

   ```bash
   curl --fail-with-body https://integrations.allomancy.net/v1/customer-tokens \
     -H "X-API-Key: <your-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "customerIdentifier": "resident.username",
       "collectiveId": "3a1f0c9b-7d2e-4c84-9a6f-1b5e8d0c2a37"
     }'
   ```

> **This key is server-side only and is NEVER used by this page.** The SPA only reads
> the opaque token from the `#ct=` fragment and sends it as a short-lived
> `X-Customer-Token`. **Never put the API key (or any secret) in this SPA**, because
> everything here ships to the browser.

---

## API reference

This is the complete surface this page talks to: the `/v1/customer/*` endpoints of
the Allomancy customer API (`https://integrations.allomancy.net`). Every function in
`src/api/customerClient.ts` maps to
one entry below. You can build your own client from this section alone — the examples
are real responses from a live backend, with ids, tokens, and names replaced by
obvious placeholders.

### Conventions (read once)

**Base URL.** `https://integrations.allomancy.net` in production (hard-coded in
`customerClient.ts`; override for local dev via `VITE_API_BASE_URL`). All paths below
are relative to it.

**Auth.** Every request carries the per-customer token as a header — no cookies, no
`Authorization`, no API key:

```bash
curl https://integrations.allomancy.net/v1/customer/profile \
  -H "X-Customer-Token: <customer-token>" \
  -H "Accept: application/json"
```

The token is the opaque value from the `#ct=` link fragment. It is short-lived and
store-scoped: the server derives which customer and which store(s) you can see from
the token itself — you never pass a customer or store id to prove identity.

**Errors.** Failures come back as RFC 9457 Problem Details
(`application/problem+json`) with a top-level machine-readable `code` you can switch on:

```json
{
  "type": "https://integrations.allomancy.net/errors/news_item_not_available",
  "title": "Item not available",
  "detail": "This post has no on-demand item you can request.",
  "status": 400,
  "code": "news_item_not_available"
}
```

- **401** — the token is expired, invalid, or revoked. The link is dead; the customer
  needs a fresh one. (`customerClient.ts` clears the stored token on a 401.)
- **429** — rate limited. Honor the `Retry-After` response header (seconds) before
  retrying.
- other non-2xx — a Problem Details body as above; read `code` for the specific reason.

**Pagination.** List endpoints return a cursor envelope. Read `data`, then page forward
by passing `pagination.nextCursor` back as the `cursor` query param until it comes back
`null`:

```json
{
  "data": [ /* … items … */ ],
  "pagination": { "nextCursor": null, "previousCursor": null, "limit": 24 }
}
```

Query params on every list endpoint: `limit` (page size, this client sends `24` by
default), `cursor` (opaque; omit for the first page), and `storeId` (optional; restrict
to one store — only meaningful for a collective token that spans several).

**Money.** All amounts are Linden Dollars (`L$`) as plain integers.

**Enums are integers on the wire.** Where a field is an enum (e.g. a transaction
`type`), the JSON carries the numeric value, not a name. Map it to a label yourself and
treat any unknown integer as a generic fallback — never assume the range is closed.

---

### GET /v1/customer/profile

The customer to greet (avatar identity for the header).

```json
{
  "uuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "username": "resident.example",
  "pictureUuid": null
}
```

| Field | Type | Meaning |
|---|---|---|
| `uuid` | string (UUID) | The customer's Second Life avatar UUID. |
| `username` | string | The avatar's username. |
| `pictureUuid` | string \| null | SL texture UUID for the avatar picture; `null` when unset. |

---

### GET /v1/customer/context

The brand for the header plus the store(s) the customer's items span. One store today; a
collective token returns several, with no shape change (each list item resolves its
store by `storeId`).

```json
{
  "brand": { "name": "Example Store", "logo": null },
  "stores": [
    { "id": "11111111-1111-1111-1111-111111111111", "name": "Example Store", "logo": null }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `brand.name` | string | Header brand name (a single store, or a collective's umbrella). |
| `brand.logo` | string \| null | SL texture UUID for the brand logo; `null` when unset. |
| `stores[].id` | string (UUID) | Store id; other responses reference stores by this. |
| `stores[].name` | string | Store display name. |
| `stores[].logo` | string \| null | SL texture UUID for the store logo; `null` when unset. |

---

### GET /v1/customer/account

Per-store balances, one entry per in-scope store. This is where **expiring credit** is
reported, via `creditLots`.

```json
{
  "accounts": [
    {
      "storeId": "11111111-1111-1111-1111-111111111111",
      "credit": 1250,
      "restrictedCredit": 200,
      "discount": 0,
      "creditLots": [
        { "amount": 120, "expiresAt": "2026-07-30T12:00:00Z", "restricted": false },
        { "amount": 200, "expiresAt": "2026-09-11T12:00:00Z", "restricted": true },
        { "amount": 400, "expiresAt": "2026-11-15T12:00:00Z", "restricted": false }
      ]
    }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `accounts[].storeId` | string (UUID) | Which store this balance is for. |
| `accounts[].credit` | number (L$) | Store credit. |
| `accounts[].restrictedCredit` | number (L$) | Restricted store credit (spend limited to that store's own products). |
| `accounts[].discount` | number | Loyalty discount as a raw percent (0–100), **not** a currency amount. |
| `accounts[].creditLots` | array | Active credit lots with expiry dates — see below. |

**`creditLots`** breaks the balance into the dated chunks it is made of. A **lot** is
`{ amount, expiresAt, restricted }`:

| Field | Type | Meaning |
|---|---|---|
| `amount` | number (L$) | Remaining value in this lot. |
| `expiresAt` | string (ISO-8601 UTC, `Z`) | When this lot expires. |
| `restricted` | boolean | `true` = restricted credit, shown as a separate section. |

The server returns **active lots only** (positive remaining, open, not expired), sorted
by `expiresAt` **ascending**. That order is meaningful: the soonest-to-expire lot is
spent first. The array is **empty when the store has no dated credit** (including a
zero-balance store). Older backends may omit `creditLots` entirely — treat absent or
empty the same: "no dated credit". Undated credit (credit with no `expiresAt`) is
included in `credit` / `restrictedCredit` but not represented as a lot; it is whatever
remains after summing the lots. Just after a lot expires, the top-level `credit` may
briefly exceed the sum of `creditLots` until the backend's periodic reconciliation runs;
it is corrected on the next spend.

**Empty / zero-balance store:**

```json
{
  "accounts": [
    { "storeId": "11111111-1111-1111-1111-111111111111", "credit": 0, "restrictedCredit": 0, "discount": 0, "creditLots": [] }
  ]
}
```

**Collective (multi-store) token** — one entry per store; each carries its own
`creditLots`:

```json
{
  "accounts": [
    { "storeId": "11111111-1111-1111-1111-111111111111", "credit": 1250, "restrictedCredit": 200, "discount": 0, "creditLots": [ { "amount": 120, "expiresAt": "2026-07-30T12:00:00Z", "restricted": false } ] },
    { "storeId": "22222222-2222-2222-2222-222222222222", "credit": 350,  "restrictedCredit": 0,   "discount": 0, "creditLots": [ { "amount": 300, "expiresAt": "2026-08-27T12:00:00Z", "restricted": false } ] }
  ]
}
```

---

### GET /v1/customer/redelivery/products

One page of the products this customer can request a redelivery of. Paged (see the
pagination convention).

```
GET /v1/customer/redelivery/products?limit=24
```

Empty for a customer with nothing redeliverable:

```json
{ "data": [], "pagination": { "nextCursor": null, "previousCursor": null, "limit": 24 } }
```

Fields present on each item when the list is populated (from the wire type
`RedeliverableProduct`):

| Field | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | Product id — pass this to `POST /v1/customer/redelivery`. |
| `name` | string | Product display name. |
| `image` | string \| null | SL texture UUID for the product image; `null` → fallback art. |
| `storeId` | string (UUID) | Owning store; resolve against the context's stores (collective-ready). |

---

### POST /v1/customer/redelivery

Request a redelivery of one product in-world. This triggers an in-world side effect.

```bash
curl https://integrations.allomancy.net/v1/customer/redelivery \
  -H "X-Customer-Token: <customer-token>" \
  -H "Content-Type: application/json" \
  -d '{ "productId": "d0000000-0000-4000-8000-000000000001" }'
```

| Body field | Type | Meaning |
|---|---|---|
| `productId` | string (UUID) | The `id` of a `RedeliverableProduct`. |

Response is a bare JSON boolean — `true` on success:

```json
true
```

---

### GET /v1/customer/transactions

One page of the customer's in-world transactions. Paged.

```
GET /v1/customer/transactions?limit=24
```

Empty for a customer with no transaction history:

```json
{ "data": [], "pagination": { "nextCursor": null, "previousCursor": null, "limit": 24 } }
```

Fields present on each item when the list is populated (from the wire type
`Transaction`):

| Field | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | Row id — a stable key, not for display. |
| `payment` | number (L$) | Amount paid. |
| `location` | string | SL region name; may be empty. |
| `productName` | string | Product involved. |
| `storeName` | string | Store display name. |
| `storeId` | string (UUID) | Owning store id (collective-ready). |
| `payerUsername` | string | Paying resident's username. |
| `payerUuid` | string (UUID) | Paying resident's avatar UUID. |
| `receiverUsername` | string | Receiving resident's username. |
| `receiverUuid` | string (UUID) | Receiving resident's avatar UUID. |
| `delivered` | boolean | Whether the item was delivered. |
| `failedToDeliver` | boolean | Whether delivery failed. |
| `type` | number | A numeric transaction-type code (see *enums are integers*). Map to a label; unknown ints → a generic label. |
| `created` | string (ISO-8601 UTC) | When the transaction happened. |
| `usedCouponId` | string \| null | Internal coupon id; presence means "a coupon was applied" — render as a boolean indicator, never show the value. |
| `usedCredit` | number \| null | Store credit spent. Populated **only when the viewer is the payer**; `null` otherwise — render only when non-null. |
| `usedDiscount` | number \| null | Discount applied. Payer-only, same rule. |
| `remainingCredit` | number \| null | Credit left after this payment. Payer-only, same rule. |

---

### GET /v1/customer/giftcards

One page of the customer's gift cards. Paged. This is where gift-card **expiry** is
reported, via `expiresAt`.

```json
{
  "data": [
    {
      "id": "f0000000-0000-4000-8000-000000000001",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "ownerUuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "ownerUsername": "resident.example",
      "credit": 150,
      "active": true,
      "redeemed": false,
      "transfer": true,
      "texture": "00000000-0000-0000-0000-000000000000",
      "purchased": false,
      "expiresAt": "2026-08-07T12:00:00Z"
    },
    {
      "id": "f0000000-0000-4000-8000-000000000002",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "ownerUuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "ownerUsername": "resident.example",
      "credit": 300,
      "active": true,
      "redeemed": false,
      "transfer": true,
      "texture": "00000000-0000-0000-0000-000000000000",
      "purchased": false,
      "expiresAt": null
    },
    {
      "id": "f0000000-0000-4000-8000-000000000003",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "ownerUuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "ownerUsername": "resident.example",
      "credit": 75,
      "active": true,
      "redeemed": false,
      "transfer": false,
      "texture": "00000000-0000-0000-0000-000000000000",
      "purchased": false,
      "expiresAt": null
    }
  ],
  "pagination": { "nextCursor": null, "previousCursor": null, "limit": 24 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | Gift card id — pass to redeem/transfer. |
| `storeId` | string (UUID) | Owning store; resolve for its logo/name (collective-ready). |
| `ownerUuid` | string (UUID) | Current owner's avatar UUID. |
| `ownerUsername` | string | Current owner's username. |
| `credit` | number (L$) | Card value. |
| `active` | boolean | Whether the card is active. |
| `redeemed` | boolean | Whether it has been redeemed. |
| `transfer` | boolean | Whether transfer is allowed (gates the Transfer action). |
| `texture` | string \| null | SL texture UUID for the card art; `null` → fallback. |
| `purchased` | boolean | Provenance label only (`true` = purchased, `false` = gifted); does **not** gate actions. |
| `expiresAt` | string (ISO-8601 UTC) \| null | When the card's credit expires; `null`/absent = no expiry. See below. |

**`expiresAt`.** A nullable ISO-8601 UTC timestamp. Two things the server guarantees, so
the client doesn't have to:

- **Expired-unredeemed cards never appear** in this list — they are filtered out
  server-side. A card you see with a past `expiresAt` is one that was already redeemed.
- **Redeem and transfer of an expired card are rejected server-side** (Problem Details).
  The redeemed credit still expires on `expiresAt` regardless of *when* it was redeemed,
  so redeeming late does not extend the deadline.

The client additionally filters the displayed wall to `active && !redeemed`; all other
states are returned so a fork can present them differently if it wants.

---

### POST /v1/customer/giftcards/{id}/redeem

Redeem a gift card to store credit. No request body. Value-moving.

```bash
curl https://integrations.allomancy.net/v1/customer/giftcards/f0000000-0000-4000-8000-000000000001/redeem \
  -H "X-Customer-Token: <customer-token>" \
  -X POST
```

| Path param | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | The gift card `id`. |

Response is a bare JSON boolean — `true` on success. Redeeming an expired card is
rejected with a Problem Details error (see `expiresAt` above).

```json
true
```

---

### POST /v1/customer/giftcards/{id}/transfer

Transfer a gift card to another resident. **Value-moving and irreversible** — confirm
with the customer before calling.

```bash
curl https://integrations.allomancy.net/v1/customer/giftcards/f0000000-0000-4000-8000-000000000001/transfer \
  -H "X-Customer-Token: <customer-token>" \
  -H "Content-Type: application/json" \
  -d '{ "receiverIdentifier": "resident.example" }'
```

| Param | Type | Meaning |
|---|---|---|
| `id` (path) | string (UUID) | The gift card `id`. |
| `receiverIdentifier` (body) | string | The recipient — a Second Life username **or** an avatar UUID; the server resolves it. |

Response is a bare JSON boolean — `true` on success. Requires the card's `transfer`
flag; transferring an expired card is rejected server-side.

```json
true
```

---

### GET /v1/customer/news

One page of the customer's in-scope News Kiosk posts. Paged.

```json
{
  "data": [
    {
      "id": "e0000000-0000-4000-8000-000000000001",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "message": "Grand reopening this weekend — new items in store!",
      "item": null,
      "onDemandItem": false,
      "canRequestItem": false,
      "created": "2026-07-18T01:16:45Z"
    },
    {
      "id": "e0000000-0000-4000-8000-000000000002",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "message": "A free gift for our subscribers.",
      "item": "Example Item — Summer Tote",
      "onDemandItem": true,
      "canRequestItem": true,
      "created": "2026-07-18T01:16:45Z"
    },
    {
      "id": "e0000000-0000-4000-8000-000000000003",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "message": "Thanks for being a member, {name}!",
      "item": "Example Item — Welcome Pack",
      "onDemandItem": true,
      "canRequestItem": true,
      "created": "2026-07-18T01:16:45Z"
    }
  ],
  "pagination": { "nextCursor": null, "previousCursor": null, "limit": 24 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | Post id — a key, and the path param for `request-item`. |
| `storeId` | string (UUID) | Owning store; resolve for the attribution chip. |
| `message` | string | Post body. May contain `{username}` / `{name}` placeholders (substitute per-viewer, client-side) and bare URLs/emails (linkify client-side — never via `innerHTML`). |
| `item` | string \| null | The associated item's name, or `null` when the post has none. The server normalizes `""`/none → `null`, so test `item != null`. |
| `onDemandItem` | boolean | Whether the item is delivered on demand (gates the "Get item" affordance). |
| `canRequestItem` | boolean | Server-computed: item present **and** on-demand **and** the caller is an active subscriber of the store. Use it **directly** to enable/disable "Get item" — never recompute it. |
| `created` | string (ISO-8601 UTC) | When the post was published. |

---

### GET /v1/customer/news/unread

The unread-badge source. One entry per in-scope store, **including `count: 0`**; key it
by `storeId` (order is not guaranteed).

```json
{
  "total": 3,
  "byStore": [
    { "storeId": "11111111-1111-1111-1111-111111111111", "count": 3 }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `total` | number | Total unread across all in-scope stores (drives the header badge). |
| `byStore[].storeId` | string (UUID) | A store in scope. |
| `byStore[].count` | number | Unread count for that store (may be `0`). |

---

### POST /v1/customer/news/seen

Mark News posts as seen (clears the unread count). Replies **204 No Content** — there is
no response body.

```bash
curl https://integrations.allomancy.net/v1/customer/news/seen \
  -H "X-Customer-Token: <customer-token>" \
  -H "Content-Type: application/json" \
  -d '{ "storeId": null }'
```

| Body field | Type | Meaning |
|---|---|---|
| `storeId` | string (UUID) \| null | Which store to mark seen. `null` (the client default) clears **all** in-scope stores. |

Success is the `204` status alone; the client ignores the (empty) body.

---

### POST /v1/customer/news/{id}/request-item

Request a post's on-demand item in-world. No request body; triggers an in-world side
effect.

```bash
curl https://integrations.allomancy.net/v1/customer/news/e0000000-0000-4000-8000-000000000002/request-item \
  -H "X-Customer-Token: <customer-token>" \
  -X POST
```

| Path param | Type | Meaning |
|---|---|---|
| `id` | string (UUID) | The News post `id`. Only valid when that post's `canRequestItem` is `true`; otherwise the server returns a Problem Details error (e.g. `code: "news_item_not_available"`). |

The server replies with a bare `true`; the client treats any 2xx as success and ignores
the body.

---

## Customize / Adapt

> The deploy + connect steps above are all a merchant needs. This section is for a
> developer or AI agent adapting the template. It assumes React / Vite / Tailwind
> familiarity and just points at the right files. Rebuild (`pnpm build`) and
> redeploy after any change.

### Project structure

```
src/
  main.tsx                captures the #ct token, then mounts the router
  App.tsx                 auth gate (no-token / expired) + the <Route> list
  components/AppLayout.tsx  sticky header (logo + avatar / balances / tabs) + <Outlet/>
  pages/                  one component per route (Redelivery / Transactions / GiftCards / News)
  components/             app pieces: cards, dialogs, skeletons, BrandHeader, …
  components/ui/          shadcn primitives (button, card, dialog, badge, …)
  api/customerClient.ts   the ONLY module that calls the backend (one fn per endpoint)
  api/types.ts            request/response wire types
  lib/                    slImage (texture URLs), useCursorList / useStore (data), format, cn
  config/viewRoutes.ts    deep-link section-to-route map
  auth/token.ts           token capture/storage (security core; see "Don't touch")
  index.css               Tailwind entry + the theme tokens
```

### Rebrand

By default the brand name and logo come automatically from the customer's
store context (`GET /v1/customer/context`, via `useStore`), so the page shows whatever
store the link belongs to. Each item also carries a `storeId` that the page resolves
against `storesById`, so it is ready for multi-store collectives with no shape change.
This is just for convenience, and you don't need to use it. You can customize everything with your own images and layout preferences.

### Retheme

`src/index.css` has one knob: change **`--primary`** (OKLCH). Every token shares
its hue, so re-derive the whole set with the same hue (a shadcn theme generator
like [tweakcn](https://tweakcn.com) is fastest: export the OKLCH block into `:root`
/ `.dark`) and re-check text contrast stays WCAG AA.

### Add / remove a tab (page)

1. Add a route component under `src/pages/`.
2. Register it in `src/App.tsx` (the `<Route>` list).
3. Add/remove its entry in the `navItems` array in `src/components/AppLayout.tsx`
   (the tab bar is driven by that array). A tab can opt into an unread badge with
   `showsUnreadNews: true` — that is how the **News** tab surfaces the count from
   `GET /v1/customer/news/unread`.

The four tabs today are Redelivery (`/`), Transactions, Gift cards, and News. Copy an
existing page (e.g. `TransactionsPage`) for the data + loading/empty/error pattern;
paged lists use the `useCursorList` hook. `NewsPage` additionally clears its unread
badge on open (marks posts seen, then revalidates the shared `news-unread` key).

### Deep links (`?view=`)

The backend sends links as `{origin}/?view={section}#ct={token}`. On load the app
maps `view` to a route via **`src/config/viewRoutes.ts`** (`VIEW_ROUTES`) and
navigates there once (currently `giftcards` → `/giftcards`); an absent or unknown
`view` stays at `/`. To support your own sections, edit that map. (The `#ct=` token
is separate, captured by `auth/token.ts`.)

### Data / API surface

- `src/api/customerClient.ts`: every backend call, one typed function per endpoint:
  `getProfile`, `getStoreContext`, `getCustomerAccount`, `getRedeliverableProducts`,
  `requestRedelivery`, `getTransactions`, `getGiftCards`, `redeemGiftCard`,
  `transferGiftCard`, `getNews`, `getNewsUnread`, `markNewsSeen`, `requestNewsItem`.
  All go through the shared `request()`. See the **API reference** section above for the
  method, path, params, and response of each.
- `src/api/types.ts`: the wire types for those.
- The backend is **pre-wired** to `https://integrations.allomancy.net` (override for
  local dev via `VITE_API_BASE_URL`). To add an endpoint: add a method here + its
  type, then call it from a page (via SWR or `useCursorList`).

### Don't touch (security core)

Leave these unless you understand the customer-token model:

- **`src/auth/token.ts`**: reads the `#ct=` token, stores it in `sessionStorage`,
  scrubs the fragment from the URL. The only place the token is read/cleared.
- **`src/api/customerClient.ts` → `request()`**: attaches the `X-Customer-Token`
  header with `credentials: 'omit'`, maps 401/429/ProblemDetails, never logs the
  token. Add new endpoint methods around it, but don't change `request()` itself.
- **`src/lib/slImage.ts`**: the Second Life texture-URL builder.

### Local development

```bash
pnpm install
pnpm dev      # https://localhost:5173 (self-signed cert, accept it once)
pnpm build    # → static dist/
pnpm lint     # oxlint
```

Talks to the production backend by default, so `pnpm dev` needs no setup. To run
against a local backend, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.
