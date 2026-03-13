import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { HandPathData } from "./HandPathData";
import type { SoloPropStepData } from "./SoloPropStepData";

export interface SoloPropData {
  readonly id: string;
  readonly steps: readonly SoloPropStepData[];
  readonly startLocation: GridLocation;
  readonly startOrientation: Orientation;

  // Content-addressable identity
  readonly contentHash: string;

  // Compositional: every solo prop contains its hand path
  readonly handPath: HandPathData;

  // Derived query fields (delegated from hand path + own data)
  readonly length: number;
  readonly bigrams: readonly string[];
  readonly impliedGridMode: GridMode;

  // Metadata
  readonly name?: string;
  readonly author?: string;
  readonly notes?: string;
  readonly thumbnails?: readonly string[];
  readonly dateCreated?: Date;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
}
