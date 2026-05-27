<script lang="ts">
  import { page } from "$app/state";
  import ProductDetailPage from "$lib/features/store/ProductDetailPage.svelte";

  let productId = $derived(page.params.productId!);
</script>

<svelte:head>
  <title>Store | The Kinetic Alphabet</title>
</svelte:head>

<ProductDetailPage {productId} />
