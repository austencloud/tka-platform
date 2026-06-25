<script lang="ts">
  // Nav + cosmic background come from +layout.svelte.
  import { page } from "$app/state";
  import ProductDetailPage from "$lib/features/store/ProductDetailPage.svelte";

  let productId = $derived(page.params.productId!);
</script>

<svelte:head>
  <title>Shop | The Kinetic Alphabet</title>
</svelte:head>

<ProductDetailPage {productId} />
