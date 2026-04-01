import { createContainer } from "iti";
import { ProductLoader } from "$lib/features/store/services/implementations/ProductLoader";
import { MerchCheckoutCreator } from "$lib/features/store/services/implementations/MerchCheckoutCreator";

export function createStoreContainer() {
  return createContainer().add({
    productLoader: () => new ProductLoader(),
    merchCheckoutCreator: () => new MerchCheckoutCreator(),
  });
}

export type StoreContainer = ReturnType<typeof createStoreContainer>;
