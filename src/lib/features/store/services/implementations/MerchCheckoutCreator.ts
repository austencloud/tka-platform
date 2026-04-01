import { getFunctions, httpsCallable } from "firebase/functions";
import type { IMerchCheckoutCreator } from "../contracts/IMerchCheckoutCreator";

export class MerchCheckoutCreator implements IMerchCheckoutCreator {
  async createCheckoutSession(productId: string): Promise<string> {
    const functions = getFunctions();
    const createCheckout = httpsCallable<{ productId: string }, { url: string }>(
      functions,
      "createMerchCheckout"
    );
    const result = await createCheckout({ productId });
    return result.data.url;
  }
}
