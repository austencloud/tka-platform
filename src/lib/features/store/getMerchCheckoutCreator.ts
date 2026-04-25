import type { IMerchCheckoutCreator } from './services/contracts/IMerchCheckoutCreator';
import { MerchCheckoutCreator } from './services/implementations/MerchCheckoutCreator';

let instance: IMerchCheckoutCreator | null = null;
export function getMerchCheckoutCreator(): IMerchCheckoutCreator {
  return instance ??= new MerchCheckoutCreator();
}
