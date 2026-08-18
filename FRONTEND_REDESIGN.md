# Frontend Redesign Checklist — Hygglo-Inspired

**Goal:** Redesign the entire NeighbourShare frontend to mimic the clean, marketplace aesthetic of [hygglo.com/uk](https://hygglo.com/uk) — white surfaces, near-black typography, image-forward item cards, category chips, trust badges, and a marketing-style home page. Brand colors are original and vibrant (electric violet + fuchsia + lime — deliberately not copied from Hygglo).

**Status legend:** ✅ Completed · ⬜ Pending

---

## Design System
- [x] ✅ **Brand palette** in `tailwind.config.js` — vibrant **electric violet** `brand` scale + hot fuchsia `accent` scale + electric lime `energy` scale + `brand-gradient` utility
- [x] ✅ **Typography & base styles** in `index.css` (Plus Jakarta Sans, body bg, focus rings, component classes: `btn-primary`, `btn-secondary`, `input-field`, `card`, `badge`)
- [x] ✅ **`index.html`** — updated theme color, meta description, title

## Layout & Shell
- [x] ✅ **Navbar** — Hygglo-style: logo, nav links, vibrant violet→fuchsia "Create listing" CTA + announcement strip, auth menu, mobile menu
- [x] ✅ **Footer** — light footer with link columns + social icons + trust strip

## Pages
- [x] ✅ **Home page** (`/`) — hero "Borrow instead of buying" + search (gradient headline, violet/fuchsia/lime blobs), popular categories, live item feed, "How it works" (gradient step icons), "Why NeighbourShare" trust pillars, testimonials, gradient CTA band
- [x] ✅ **Item card** — image-forward vertical card (image top, category badge, title, description, "Credits/day", owner/trust, distance) + compact variant for map panel; keyboard accessible
- [x] ✅ **Browse page** (`/browse`) — category chips, radius/sort controls, grid list view, widen-search suggestion
- [x] ✅ **Map removed from Browse entirely** — the leaflet map, map/list toggle, "Sign in for the map" lock chip and all auth/viewMode logic are gone. The page is a clean list for everyone (no login gating). The small map on the **Item detail** page remains untouched (separate page).
- [x] ✅ **Browse snapshot panel** (replaces the map) — a vibrant `brand-gradient` card showing live stats computed from the fetched results: items found, closest item distance, average credits/day, category count, plus clickable top-category chips (with counts) that filter the grid. Hides cleanly during loading / empty states.
- [x] ✅ **Item detail** — breadcrumb, image gallery + thumbnails, price box, borrow form, owner card, tabs, sticky action card
- [x] ✅ **Create / edit listing** — sectioned form (3 steps), dropzone uploads, brand styling
- [x] ✅ **Login** — centered brand split card (brand panel on desktop)
- [x] ✅ **Registration wizard** — **4-step flow** with brand progress stepper: Account → **Email Verification** (6-digit code + resend) → ID Verification → Address
- [x] ✅ **Profile** — tabs (profile / listings / transactions), avatar, trust + verification badges
- [x] ✅ **My Listings** — grid of listing cards
- [x] ✅ **Public profile** — banner header card, listings grid, reviews
- [x] ✅ **Rating form** — star ratings, brand styling
- [x] ✅ **My Transactions** — filter pills, status badges, action cards
- [x] ✅ **Transaction detail** — status stepper, actions, event timeline
- [x] ✅ **QR scan / handshake** — scan status cards, QR modal (see backend fixes below)
- [x] ✅ **Admin dashboard** — stat cards, disputes table, resolve modal

## Cross-cutting
- [x] ✅ **`App.jsx`** — `/` → HomePage, `/browse` → ItemSearch, brand spinners
- [x] ✅ **`utils/formatters.jsx`** — status badge colors aligned to new palette
- [x] ✅ **`utils/categories.jsx`** — shared category metadata (icons + keyword matching + `getCategoryPlaceholder`)
- [x] ✅ **`api/index.jsx`** — `authApi.verifyEmail`/`resendVerification`; removed dead `holdDeposit`
- [x] ✅ **Offline item images** — 18 vibrant category SVGs (gradient + emoji + label) in `frontend/public/images/categories/`, bundled with the app so they render with **zero network**. New shared `components/ItemImage.jsx` shows the first uploaded photo and falls back to the category SVG when there is no photo *or* the photo fails to load (`onError`). Wired into every renderer: `ItemCard` (grid + compact), `ItemDetail` gallery, `MyListings`, `Profile` listings, `PublicProfile`. Verified live: every card's image matches its category badge, item detail shows the placeholder, and 0 external image requests.
- [x] ✅ **Mobile responsiveness** — verified in mobile viewport (hero, chips, menu, cards, footer)
- [x] ✅ **Build passes** (`npm run build` in `frontend/`) — clean build, only pre-existing chunk-size warnings
- [x] ✅ **Visual verification** — verified live against real backend data: home, browse (guest = list only + lock chip; member = map), item detail, login, mobile menu, footer
- [x] ✅ **Code review** pass — all raised issues fixed (map-panel grid, card a11y, holdDeposit, checkbox accent, hero empty search, dead `canvas` token, copy)

## Email Verification (Django built-in mail system)
- [x] ✅ **Backend** — `users/email_verify.py`: 6-digit one-time code (hashed in cache, 30-min TTL) delivered via `django.core.mail.send_mail`; `register` sends it, new `verify-email` + `resend-verification` endpoints, ID verification now requires `email_verified`, registration steps renumbered 1→4
- [x] ✅ **Settings** — `EMAIL_BACKEND` (console in dev / SMTP via env in prod), `EMAIL_HOST_*`, `DEFAULT_FROM_EMAIL`, `EMAIL_VERIFICATION_TIMEOUT`
- [x] ✅ **Frontend** — wizard step 2 collects the code with a resend link; `AuthContext.verifyEmail`/`resendVerification`; `UserProfileSerializer` exposes `email_verified`
- [x] ✅ **Verified live** — register → email printed by console backend → code accepted → wizard advances (tests: 27 users tests incl. outbox/wrong-code/resend/gating)

## QR Handshake fixes
- [x] ✅ **`qr.py` rewritten** — tokens now use the Django **cache abstraction** (was raw Redis `GETSET` → broke in local dev without Redis). Per-party single-use: the same token is scannable once by each party (max 2), replay by the same party / a third party rejected
- [x] ✅ **`scan_qr` reordered** — parses the token, checks the txn id and party membership *before* consuming a token slot
- [x] ✅ **Dead escrow/deposit removed** — `hold-deposit` URL route + frontend `holdDeposit` + `MockEcoCashProvider` imports deleted (the system is Time-Credits only)
- [x] ✅ **Frontend state machine fixed** — `TransactionDetail`/`MyTransactions`/`QRScan` now use the real states (PENDING→AGREED→ACTIVE→ITEM_OUT→ITEM_RETURNED→CLOSED): borrower **Confirm & Activate** unlocks the QR handshake; role checks use `lender`/`borrower` ids (the API never returned `item.owner`); stale ACCEPTED/DEPOSIT_HELD/deposit/escrow UI removed from AdminDashboard too
- [x] ✅ **Tests** — `tests_qr.py` rewritten (real cache, both-parties-scan-same-token, replay/third-party rejection) + `test_full_qr_handshake_cycle` drives the entire flow over the API
- [x] ✅ **Verified live** — activate → generate QR → borrower scan registers (✓ + QR_SCAN event) with real token verification in dev

## Seed data
- [x] ✅ **`items/management/commands/seed_items.py`** — `python manage.py seed_items [--per-category N] [--reset]`; **990 items, 55 per category × 18 categories**, 24 verified seed users, Harare suburbs, realistic titles/descriptions/credits/tiers, all within the 10 km search radius. Idempotent (aborts if seed items exist unless `--reset`)
- [x] ✅ **Verified live** — browse page shows ~737 items within 5 km with working snapshot stats + category chips

## Notes / Decisions
- Brand palette is intentionally vibrant and original: electric violet primary with fuchsia and lime accents (no colors copied from Hygglo). The whole app inherits the new palette through the shared `brand-*` classes in `tailwind.config.js`. A `brand-gradient` (violet→fuchsia) utility powers the CTA buttons, announcement strip, hero accents and CTA band.
- Browse map follows Hygglo's logic: browsing is list-first for everyone; the interactive map and map/list toggle are members-only.
- Home "recently active" feed uses the real `/items/search` API (Harare center); empty/offline states are handled gracefully.
- Testimonials section is static placeholder copy (no reviews endpoint yet) — flagged as a follow-up to wire real data.
- **Free-text keyword search (`q`) is live** — `/items/search` filters by title/description (`icontains`) in both GDAL and Haversine modes; the home hero search passes `q` (plus a matched `category` when keywords map to one) to `/browse`, which syncs it from the URL and shows a results badge with a Clear button. Verified end to end: hero "laptop" → browse returns both laptops.
- The QR handshake token is deliberately single-use-per-party (both parties scan the SAME QR once each; max 2 scans) — each phase (handoff, return) requires a freshly generated token.
- Email verification in local dev prints the code to the Django console (console backend) — no SMTP needed. Production uses `EMAIL_HOST_*` env vars (defaults to Gmail-style SMTP settings).
- Backend test suite fixed along the way (was 27+ failures): stale removed-field references (`daily_rate_usd`/`deposit_amount`/`DEPOSIT_HELD`), missing trailing slashes on action URLs, a real owner-check gap on item updates, a missing `borrower.profile` source in `TransactionSerializer` (every transaction response 500'd), a UUID-vs-int PK migration drift on `transaction_events`/`ratings` (new `0004` migration), and `RatingSerializer.transaction` being required though the view sets it. **All 103 backend tests now pass** (users 27, items 20, transactions 56).

## Suggested Next Steps
- ⬜ Seed actual uploaded photos (media files) for seed items so the API itself carries images, not just frontend placeholders
- ⬜ Wire real reviews/testimonials when a reviews endpoint exists
- ⬜ Create static legal/support pages for footer links (/privacy, /terms, /faq, etc.)
- ⬜ Center browse/home searches on the user's verified `home_location` when logged in (currently hardcoded to Harare center)
- ⬜ Add a `verify-email` deep-link route (click-the-link in the email) in addition to the 6-digit code
- ⬜ Seed a few demo transactions + ratings so the admin dashboard and trust scores have data to show
