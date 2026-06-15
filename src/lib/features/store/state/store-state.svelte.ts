import type { Product } from "../domain/models/product";

interface ProductLoader {
  loadActiveProducts(): Promise<Product[]>;
  loadProduct(productId: string): Promise<Product | null>;
}

interface CheckoutCreator {
  createCheckoutSession(productId: string): Promise<string>;
}

export function createStoreState(
  productLoader: ProductLoader,
  checkoutCreator: CheckoutCreator
) {
  let products = $state<Product[]>([]);
  let selectedProduct = $state<Product | null>(null);
  let isLoading = $state(false);
  let isCheckingOut = $state(false);
  let error = $state<string | null>(null);

  async function loadProducts() {
    isLoading = true;
    error = null;
    try {
      products = await productLoader.loadActiveProducts();
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
    error = null;
    try {
      const url = await checkoutCreator.createCheckoutSession(productId);
      window.location.href = url;
    } catch (e) {
      error = "Failed to start checkout. Please try again.";
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
    loadProducts,
    loadProduct,
    startCheckout,
  };
}

export type StoreState = ReturnType<typeof createStoreState>;
