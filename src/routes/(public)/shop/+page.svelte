<script lang="ts">
  // /shop — admin sees the live shop (incl. drafts); everyone else (signed out OR
  // signed-in non-admin) sees Coming Soon. Same URL. Launch later = drop the gate.
  // Chrome (nav + cosmic background) is provided by +layout.svelte.
  import { onMount } from "svelte";
  import StorePage from "$lib/features/store/StorePage.svelte";
  import ShopComingSoon from "$lib/features/store/components/ShopComingSoon.svelte";

  let ready = $state(false);
  let isAdmin = $state(false);

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
            } catch (e) {
              console.error("[shop] token claim read failed:", e);
            }
          } else {
            isAdmin = false;
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
</svelte:head>

<!-- Default to Coming Soon while auth resolves: the common visitor is non-admin,
     so this avoids a blank flash. Admin briefly sees Coming Soon, then the shop. -->
{#if ready && isAdmin}
  <StorePage showDrafts />
{:else}
  <ShopComingSoon />
{/if}
