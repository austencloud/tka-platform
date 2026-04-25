import type { IProductLoader } from './services/contracts/IProductLoader';
import { ProductLoader } from './services/implementations/ProductLoader';

let instance: IProductLoader | null = null;
export function getProductLoader(): IProductLoader {
  return instance ??= new ProductLoader();
}
