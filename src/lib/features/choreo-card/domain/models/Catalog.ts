import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface CatalogFamily {
  readonly id: string;
  readonly label: string;
  readonly typeCombo: string;
  readonly sequenceIds: readonly string[];
}

export interface Catalog {
  readonly id: string;
  readonly name: string;
  readonly canonicalName: string;
  readonly description: string;
  readonly families: readonly CatalogFamily[];
  readonly totalSequences: number;
  readonly gridMode: GridMode;
  readonly level: number;
  readonly collection: 'LOOPs' | 'TnD';
  readonly loopType: string;
  readonly sliceType: 'halved' | 'quartered';
  readonly stepCount: number;
  readonly turnPattern: string;
  readonly reversalPattern: string;
  /** Asymmetric blue|red turn enumerations reference a base deck's sequences and store none of their own. */
  readonly asymmetric?: boolean;
  /** Catalog id this deck derives its sequences from (set on asymmetric enumerations). */
  readonly sourceDeck?: string;
}
