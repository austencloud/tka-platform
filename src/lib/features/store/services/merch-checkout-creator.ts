import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "$lib/shared/auth/firebase";

export async function createCheckoutSession(productId: string): Promise<string> {
  const functions = getFunctions(app);
  const createCheckout = httpsCallable<{ productId: string }, { url: string }>(
    functions,
    "createMerchCheckout"
  );
  const result = await createCheckout({ productId });
  return result.data.url;
}
