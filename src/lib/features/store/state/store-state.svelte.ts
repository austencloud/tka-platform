import type { Product } from "../domain/models/product";

interface ProductLoader {
  loadActiveProducts(): Promise<Product[]>;
  loadAllProducts(): Promise<Product[]>;
  loadProduct(productId: string): Promise<Product | null>;
}

interface CheckoutCreator {
  createCheckoutSession(productId: string): Promise<string>;
}

export function createStoreState(
  productLoader: ProductLoader,
  checkoutCreator: CheckoutCreator,
  initialProduct: Product | null = null
) {
  let products = $state<Product[]>([]);
  let selectedProduct = $state<Product | null>(initialProduct);
  let isLoading = $state(false);
  let isCheckingOut = $state(false);
  let error = $state<string | null>(null);
  // Separate from `error` (which is a load error that replaces the page) so a
  // failed checkout shows inline by the Buy button instead of blanking the product.
  let checkoutError = $state<string | null>(null);

  // includeAll = admin "play with it" view: drafts + sold-out too. Public
  // buyers always get the active-only list.
  async function loadProducts(includeAll = false) {
    isLoading = true;
    error = null;
    try {
      products = includeAll
        ? await productLoader.loadAllProducts()
        : await productLoader.loadActiveProducts();
    } catch (e) {
      error = "Failed to load products. Please try again.";
      console.error("[Store] Failed to load products:", e);
    } finally {
      isLoading = false;
    }
  }

  async function loadProduct(productId: string) {
    isLoading = true;
    error = null;
    try {
      selectedProduct = await productLoader.loadProduct(productId);
      if (!selectedProduct) {
        error = "Product not found.";
      }
    } catch (e) {
      error = "Failed to load product. Please try again.";
      console.error("[Store] Failed to load product:", e);
    } finally {
      isLoading = false;
    }
  }

  async function startCheckout(productId: string) {
    isCheckingOut = true;
    checkoutError = null;
    try {
      const url = await checkoutCreator.createCheckoutSession(productId);
      window.location.href = url;
    } catch (e) {
      checkoutError = "Checkout isn't available yet. Try again later.";
      console.error("[Store] Checkout failed:", e);
    } finally {
      isCheckingOut = false;
    }
  }

  return {
    get products() { return products; },
    get selectedProduct() { return selectedProduct; },
    get isLoading() { return isLoading; },
    get isCheckingOut() { return isCheckingOut; },
    get error() { return error; },
    get checkoutError() { return checkoutError; },
    loadProducts,
    loadProduct,
    startCheckout,
  };
}

export type StoreState = ReturnType<typeof createStoreState>;
