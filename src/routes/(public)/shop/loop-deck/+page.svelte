<script lang="ts">
  // Nav + cosmic background come from the (public)/shop +layout.svelte.
  import LoopDeckConfiguratorPage from "$lib/features/store/LoopDeckConfiguratorPage.svelte";
</script>

<svelte:head>
  <title>LOOP Deck | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="54 flow sequences printed as playing cards. Pick a transformation flavor and build your LOOP deck."
  />
</svelte:head>

<LoopDeckConfiguratorPage />
