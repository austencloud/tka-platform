import type { SoloPropData } from "../../domain/models/SoloPropData";
import type {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface SoloPropFilters {
  readonly startLocation?: GridLocation;
  readonly startOrientation?: Orientation;
  readonly impliedGridMode?: GridMode;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly containsBigram?: string;
  readonly pathHash?: string;
  readonly limit?: number;
}

export interface ISoloPropRepository {
  get(id: string): Promise<SoloPropData | null>;
  getByHash(contentHash: string): Promise<SoloPropData | null>;
  list(filters?: SoloPropFilters): Promise<SoloPropData[]>;
  save(soloProp: SoloPropData): Promise<void>;
  delete(id: string): Promise<void>;
}
