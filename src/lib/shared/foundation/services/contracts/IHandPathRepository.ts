import type { HandPathData } from "../../domain/models/HandPathData";
import type { ArtifactProvenance } from "../../domain/models/ArtifactProvenance";
import type {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface HandPathFilters {
  readonly startLocation?: GridLocation;
  readonly endLocation?: GridLocation;
  readonly impliedGridMode?: GridMode;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly isClosed?: boolean;
  readonly containsBigram?: string;
  readonly limit?: number;
}

export interface IHandPathRepository {
  get(id: string): Promise<HandPathData | null>;
  getByHash(contentHash: string): Promise<HandPathData | null>;
  list(filters?: HandPathFilters): Promise<HandPathData[]>;
  save(path: HandPathData, provenance?: ArtifactProvenance): Promise<void>;
  delete(id: string): Promise<void>;
}
