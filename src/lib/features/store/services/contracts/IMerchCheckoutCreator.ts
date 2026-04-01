export interface IMerchCheckoutCreator {
  createCheckoutSession(productId: string): Promise<string>;
}
