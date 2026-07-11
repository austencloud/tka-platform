<script module lang="ts">
  // Cache the admin claim for the session. Without this, navigating back to /shop
  // re-runs the async auth check with ready=false, flashing ComingSoon before the
  // grid — and that flash destroys the reverse view-transition (the cover has no
  // grid card to land on). Resolved once, then every remount is synchronous.
  let cachedIsAdmin: boolean | null = null;
</script>

<script lang="ts">
  // /shop — admin sees the live shop (incl. drafts); everyone else (signed out OR
  // signed-in non-admin) sees Coming Soon. Same URL. Launch later = drop the gate.
  // Chrome (nav + cosmic background) is provided by +layout.svelte.
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import ShopComingSoon from "$lib/features/store/components/ShopComingSoon.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Seed from the session cache first, then the SSR cookie hint (data.presumedAdmin).
  // Session cache wins when present (it's confirmed truth from this session); the
  // cookie only decides the very first frame after a full reload, so an admin skips
  // the ComingSoon flash. A confirmed non-admin in-session (cachedIsAdmin === false)
  // stays ready+ComingSoon regardless of a stale cookie.
  let ready = $state(cachedIsAdmin !== null || data.presumedAdmin);
  let isAdmin = $state(cachedIsAdmin ?? data.presumedAdmin);

  // Keep the SSR cookie in lockstep with the real claim (JS-set, UI-hint only).
  function syncAdminCookie(admin: boolean) {
    document.cookie = admin
      ? "tka_shop_admin=1; path=/; max-age=2592000; samesite=lax"
      : "tka_shop_admin=; path=/; max-age=0; samesite=lax";
  }

  onMount(async () => {
    try {
      // Read the admin custom claim STRAIGHT from Firebase Auth. Deliberately NOT
      // via authState — that boots the app's module/nav system
      // (revalidateCurrentModule), which has no business on a public page.
      const [{ getAuthInstance }, { onAuthStateChanged }] = await Promise.all([
        import("$lib/shared/auth/firebase"),
        import("firebase/auth"),
      ]);
      const auth = await getAuthInstance();
      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
          if (user) {
            try {
              const token = await user.getIdTokenResult();
              isAdmin = token.claims.admin === true;
              cachedIsAdmin = isAdmin;
            } catch (e) {
              console.error("[shop] token claim read failed:", e);
            }
          } else {
            isAdmin = false;
            cachedIsAdmin = false;
          }
          unsub();
          resolve();
        });
      });
    } catch (e) {
      console.error("[shop] admin check failed:", e);
    } finally {
      ready = true;
      // Re-sync so the next reload's SSR seed matches reality: set for admins so
      // they skip ComingSoon, clear for everyone else so a stale cookie can't
      // leave a non-admin on an empty shell.
      syncAdminCookie(isAdmin);
    }
  });
</script>

<svelte:head>
  <title>Shop | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="Printed Choreo card decks, guides, and flow props from The Kinetic Alphabet."
  />
  <link rel="canonical" href="https://tkaflowarts.com/shop" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:title" content="Shop | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="Printed Choreo card decks, guides, and flow props from The Kinetic Alphabet."
  />
  <meta property="og:url" content="https://tkaflowarts.com/shop" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Shop | The Kinetic Alphabet" />
  <meta
    name="twitter:description"
    content="Printed Choreo card decks, guides, and flow props from The Kinetic Alphabet."
  />
</svelte:head>

<!-- Non-admins (no cookie) get ComingSoon on the server for an instant, SEO-safe
     paint. Admins (cookie seed) enter this branch, but the StorePage import stays
     browser-gated so no auth/Firestore code enters the SSR graph (per +page.ts) —
     the server renders an empty shell (cosmic background), and the client fills it
     with StorePage's own skeleton. Either way, an admin never sees ComingSoon. -->
{#if ready && isAdmin}
  {#if browser}
    {#await import("$lib/features/store/components/BakeCoversButton.svelte") then { default: BakeCoversButton }}
      <BakeCoversButton />
    {/await}
    {#await import("$lib/features/store/StorePage.svelte") then { default: StorePage }}
      <StorePage showDrafts />
    {/await}
  {/if}
{:else}
  <ShopComingSoon />
{/if}
