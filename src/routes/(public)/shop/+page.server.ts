import type { PageServerLoad } from "./$types";

// Seed the admin gate from a lightweight, JS-set cookie so SSR can pick
// shop-vs-ComingSoon WITHOUT any auth/Firestore code entering the module graph
// (the whole point of +page.ts keeping StorePage client-only). Without this, an
// admin who hard-reloads stares at "Shop opening soon" for the full Firebase
// auth round-trip, because the module-level admin cache resets on a full reload.
//
// The cookie is a UI hint only — it decides which shell renders first, nothing
// more. onMount still reads the real Firebase custom claim and re-syncs the
// cookie, and draft products stay gated by Firestore rules, so a forged/stale
// cookie reveals no data (a non-admin just briefly gets an empty shell that
// onMount flips back to ComingSoon).
export const load: PageServerLoad = ({ cookies }) => {
  return { presumedAdmin: cookies.get("tka_shop_admin") === "1" };
};
