<script lang="ts">
  import PromoGeneratorModule from "$lib/features/promo-generator/PromoGeneratorModule.svelte";
</script>

<svelte:head>
  <title>Promo Generator | TKA Composer</title>
</svelte:head>

<PromoGeneratorModule />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
