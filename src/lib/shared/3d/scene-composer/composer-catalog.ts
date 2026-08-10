import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
import type { CatalogCategory, ComposerCatalog } from "./types";

export function createComposerCatalog(
  categories: CatalogCategory[]
): ComposerCatalog {
  const items = categories.flatMap((category) => category.items);
  const definitions = new Map(items.map((item) => [item.key, item]));
  return {
    categories,
    getDefinition(key: string): ObjectDefinition | undefined {
      return definitions.get(key);
    },
    allItems(): ObjectDefinition[] {
      return items;
    },
  };
}
