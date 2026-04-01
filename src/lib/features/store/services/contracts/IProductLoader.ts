import type { Product } from "../../domain/models/Product";

export interface IProductLoader {
  loadActiveProducts(): Promise<Product[]>;
  loadProduct(productId: string): Promise<Product | null>;
}
