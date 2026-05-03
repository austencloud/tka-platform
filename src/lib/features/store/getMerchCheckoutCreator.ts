import { MerchCheckoutCreator } from './services/implementations/MerchCheckoutCreator';

let instance: MerchCheckoutCreator | null = null;
export function getMerchCheckoutCreator(): MerchCheckoutCreator {
  return instance ??= new MerchCheckoutCreator();
}
