import type { Catalog } from "./models/Catalog";

export enum CatalogSortMethod {
  NAME = "name",
  LEVEL = "level",
  SEQUENCE_COUNT = "count",
}

export const CATALOG_SORT_LABELS: Record<CatalogSortMethod, string> = {
  [CatalogSortMethod.NAME]: "Name",
  [CatalogSortMethod.LEVEL]: "Level",
  [CatalogSortMethod.SEQUENCE_COUNT]: "Cards",
};

export const CATALOG_SORT_ICONS: Record<CatalogSortMethod, string> = {
  [CatalogSortMethod.NAME]: "fa-sort-alpha-down",
  [CatalogSortMethod.LEVEL]: "fa-layer-group",
  [CatalogSortMethod.SEQUENCE_COUNT]: "fa-sort-numeric-down",
};

const comparators: Record<CatalogSortMethod, (a: Catalog, b: Catalog) => number> = {
  [CatalogSortMethod.NAME]: (a, b) => a.name.localeCompare(b.name),
  [CatalogSortMethod.LEVEL]: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  [CatalogSortMethod.SEQUENCE_COUNT]: (a, b) => a.totalSequences - b.totalSequences || a.name.localeCompare(b.name),
};

export function sortCatalogs(catalogs: Catalog[], method: CatalogSortMethod): Catalog[] {
  return [...catalogs].sort(comparators[method]);
}

export function getCatalogSectionKey(catalog: Catalog, method: CatalogSortMethod): string {
  switch (method) {
    case CatalogSortMethod.LEVEL:
      return `Level ${catalog.level}`;
    case CatalogSortMethod.SEQUENCE_COUNT: {
      if (catalog.totalSequences < 100) return "< 100";
      if (catalog.totalSequences < 1000) return "100-999";
      if (catalog.totalSequences < 10000) return "1k-10k";
      return "10k+";
    }
    case CatalogSortMethod.NAME:
    default:
      return catalog.name.charAt(0).toUpperCase();
  }
}
