import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "$lib/shared/auth/firebase";

export async function createCheckoutSession(
  productId: string,
  propType?: string
): Promise<string> {
  const functions = getFunctions(app);
  const createCheckout = httpsCallable<
    { productId: string; propType?: string },
    { url: string }
  >(functions, "createMerchCheckout");
  const result = await createCheckout(propType ? { productId, propType } : { productId });
  return result.data.url;
}
