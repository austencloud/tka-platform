import { ProductLoader } from './services/implementations/ProductLoader';

let instance: ProductLoader | null = null;
export function getProductLoader(): ProductLoader {
  return instance ??= new ProductLoader();
}
