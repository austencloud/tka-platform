import type { PageLoad } from "./$types";

export const prerender = false;
export const ssr = false;

// Load the product here (not in onMount) so a client-side navigation's
// `navigation.complete` waits for the data. That keeps the view-transition holding
// the old grid until the detail is data-ready, so the shared cover morphs cleanly
// instead of flashing the loading state mid-transition. Dynamic import keeps the
// Firebase client loader out of the SSR module graph.
export const load: PageLoad = async ({ params }) => {
  const { getProductLoader } = await import(
    "$lib/features/store/get-product-loader"
  );
  const product = await getProductLoader().loadProduct(params.productId);
  return { product, productId: params.productId };
};
