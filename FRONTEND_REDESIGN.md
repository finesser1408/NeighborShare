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
- [x] ✅ **Registration wizard** — 3-step flow, brand progress stepper
- [x] ✅ **Profile** — tabs (profile / listings / transactions), avatar, trust + verification badges
- [x] ✅ **My Listings** — grid of listing cards
- [x] ✅ **Public profile** — banner header card, listings grid, reviews
- [x] ✅ **Rating form** — star ratings, brand styling
- [x] ✅ **My Transactions** — filter pills, status badges, action cards
- [x] ✅ **Transaction detail** — status stepper, actions, event timeline
- [x] ✅ **QR scan / handshake** — scan status cards, QR modal
- [x] ✅ **Admin dashboard** — stat cards, disputes table, resolve modal

## Cross-cutting
- [x] ✅ **`App.jsx`** — `/` → HomePage, `/browse` → ItemSearch, brand spinners
- [x] ✅ **`utils/formatters.jsx`** — status badge colors aligned to new palette
- [x] ✅ **`utils/categories.jsx`** — shared category metadata (icons + keyword matching)
- [x] ✅ **`api/index.jsx`** — added missing `holdDeposit` method
- [x] ✅ **Mobile responsiveness** — verified in mobile viewport (hero, chips, menu, cards, footer)
- [x] ✅ **Build passes** (`npm run build` in `frontend/`) — clean build, only pre-existing chunk-size warnings
- [x] ✅ **Visual verification** — verified live against real backend data: home, browse (guest = list only + lock chip; member = map), item detail, login, mobile menu, footer
- [x] ✅ **Code review** pass — all raised issues fixed (map-panel grid, card a11y, holdDeposit, checkbox accent, hero empty search, dead `canvas` token, copy)

## Notes / Decisions
- Brand palette is intentionally vibrant and original: electric violet primary with fuchsia and lime accents (no colors copied from Hygglo). The whole app inherits the new palette through the shared `brand-*` classes in `tailwind.config.js`. A `brand-gradient` (violet→fuchsia) utility powers the CTA buttons, announcement strip, hero accents and CTA band.
- Browse map follows Hygglo's logic: browsing is list-first for everyone; the interactive map and map/list toggle are members-only.
- Home "recently active" feed uses the real `/items/search` API (Harare center); empty/offline states are handled gracefully.
- Testimonials section is static placeholder copy (no reviews endpoint yet) — flagged as a follow-up to wire real data.
- **Free-text keyword search (`q`) is live** — `/items/search` filters by title/description (`icontains`) in both GDAL and Haversine modes; the home hero search passes `q` (plus a matched `category` when keywords map to one) to `/browse`, which syncs it from the URL and shows a results badge with a Clear button. Verified end to end: hero "laptop" → browse returns both laptops.
- Pre-existing backend gap noted: the `hold-deposit/` URL route is registered but the `hold_deposit` view method is missing — the frontend client now has `holdDeposit` so it stops throwing a TypeError, but the deposit flow needs the backend action implemented to work end-to-end.
- Backend test suite fixed along the way (was 27+ failures): stale removed-field references (`daily_rate_usd`/`deposit_amount`/`DEPOSIT_HELD`), missing trailing slashes on action URLs, a real owner-check gap on item updates, a missing `borrower.profile` source in `TransactionSerializer` (every transaction response 500'd), a UUID-vs-int PK migration drift on `transaction_events`/`ratings` (new `0004` migration), and `RatingSerializer.transaction` being required though the view sets it. **All 91 backend tests now pass.**

## Suggested Next Steps
- ⬜ Wire real reviews/testimonials when a reviews endpoint exists
- ⬜ Implement the missing `hold_deposit` view action on the backend
- ⬜ Create static legal/support pages for footer links (/privacy, /terms, /faq, etc.)
- ⬜ Center browse/home searches on the user's verified `home_location` when logged in (currently hardcoded to Harare center)
