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
  import ShopComingSoon from "$lib/features/store/components/ShopComingSoon.svelte";

  // Seed from the session cache so a return visit renders correctly on frame one.
  let ready = $state(cachedIsAdmin !== null);
  let isAdmin = $state(cachedIsAdmin ?? false);

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

<!-- Default to Coming Soon while auth resolves: the common visitor is non-admin,
     so this avoids a blank flash. Admin briefly sees Coming Soon, then the shop. -->
{#if ready && isAdmin}
  {#await import("$lib/features/store/components/BakeCoversButton.svelte") then { default: BakeCoversButton }}
    <BakeCoversButton />
  {/await}
  {#await import("$lib/features/store/StorePage.svelte") then { default: StorePage }}
    <StorePage showDrafts />
  {/await}
{:else}
  <ShopComingSoon />
{/if}
