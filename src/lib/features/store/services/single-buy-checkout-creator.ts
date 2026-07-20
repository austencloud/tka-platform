import { createCartCheckoutSession } from "./cart-checkout-creator";
import type { LoopConfig } from "../domain/loop-config";

/** Adapts the legacy single-product checkout signature onto the cart spine:
 *  one item becomes a one-line draft order via createCartCheckout. */
export async function createCheckoutSession(
  productId: string,
  propType?: string,
  loopConfig?: LoopConfig
): Promise<string> {
  return createCartCheckoutSession([
    { productId, quantity: 1, ...(propType && { propType }), ...(loopConfig && { loopConfig }) },
  ]);
}
