import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "$lib/shared/auth/firebase";
import type { CheckoutItem } from "../state/shop-cart.svelte";

export async function createCartCheckoutSession(items: CheckoutItem[]): Promise<string> {
  const functions = getFunctions(app);
  const createCartCheckout = httpsCallable<{ items: CheckoutItem[] }, { url: string }>(
    functions,
    "createCartCheckout"
  );
  const result = await createCartCheckout({ items });
  return result.data.url;
}
