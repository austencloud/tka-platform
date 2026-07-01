# In-app Support modal — design

**Date:** 2026-06-30
**Status:** approved, implemented

## Problem

Clicking the in-app **Support** button (desktop `SidebarFooter`, mobile
`ModuleSwitcher` drawer) opened `/support` in a **new tab** (`target="_blank"`),
bouncing the user out of the app to a marketing-chrome landing page just to see
the donation options. Goal: let a user give money without leaving the app.

## Decision

Render the donation card **in-app**: a centered content-fit **modal on desktop**
and a **fullscreen flow on mobile** (Austen's pick over a bottom sheet). One
shared content component feeds the route AND the modal — no duplicated markup.

Rejected: (a) Drawer-for-mobile + Modal-for-desktop — two primitives, more code,
and `BaseModal` already fullscreens on phones; (b) duplicating the donation
markup into the modal — drift, two sources.

## Components

- **`shared/support/components/SupportContent.svelte`** (new) — the donation UI
  (amount picker `SegmentedControl`, pay-by-card, PayPal/Venmo/CashApp tiles,
  signature) lifted verbatim from `support/+page.svelte`, with NO page chrome.
  Renders on any dark surface. The Stripe-return status banner is driven by
  `donated`/`canceled` props (route passes them; modal omits them).
- **`shared/support/components/SupportModal.svelte`** (new) — wraps `BaseModal`
  `size="fit"` (content-fit centered card on desktop, no scroll) + `ModalHeader`
  (heart, "Support"). A per-instance `class="support-modal"` adds one
  `@media (max-width:520px)` override making THIS modal fullscreen on phones,
  reusing `BaseModal`'s existing `size="full"` fullscreen treatment WITHOUT
  changing the shared primitive. Desktop width nudged to `min(540px, 92vw)` so
  the 3 payment tiles aren't cramped.
- **`shared/support/state/support-modal-state.svelte.ts`** (new) — module-level
  `$state` + singleton `{ open, show(), hide() }`, mirroring
  `auth-drawer-state.svelte.ts`.

## Wiring

- `<SupportModal>` mounts once in `MainApplication.svelte` beside the auth modals,
  self-driven by `supportModalState`.
- `SidebarFooter.svelte` + `ModuleSwitcher.svelte`: the `<a href="/support"
  target="_blank">` becomes a `<button onclick={supportModalState.show}>` (same
  heart + label + styling; mobile closes the drawer first).

## Kept / unchanged

- **The `/support` route stays** — mandatory: the printed Level 1 guide QR points
  there, the marketing `SiteHeader`/footer link there, and **Stripe Checkout
  redirects back there** (`?donated=1`/`?canceled=1`). It now renders
  `<SupportContent>` inside its existing viewport-fit chrome + footer + `<head>`.
- **Payment handoff unchanged** — pay-by-card still leaves to Stripe Checkout
  (hosted, unavoidable) and returns to the route page's thank-you banner;
  PayPal/Venmo/CashApp stay new-tab deep links. The modal's win is *see options +
  pick a method* without bouncing to the landing page first.

## Out of scope

Marketing `SiteHeader`/footer links (public site, no app context — stay route
links); copy changes; new payment methods.
