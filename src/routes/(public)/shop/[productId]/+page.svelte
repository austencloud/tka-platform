<script lang="ts">
  // Nav + cosmic background come from +layout.svelte. The product is loaded in
  // +page.ts so the detail renders data-ready and the view-transition morph lands
  // cleanly (no loading-state flash mid-transition).
  import ProductDetailPage from "$lib/features/store/ProductDetailPage.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.product?.name ?? "Shop"} | The Kinetic Alphabet</title>
</svelte:head>

<ProductDetailPage productId={data.productId} initialProduct={data.product} />
