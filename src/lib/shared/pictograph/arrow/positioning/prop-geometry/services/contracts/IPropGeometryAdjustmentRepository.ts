import type { Point } from "fabric";
import type {
  PropGeometryAdjustment,
  PropGeometryAdjustmentInput,
  PropGeometryKey,
} from "../../domain/PropGeometryAdjustment";

export interface CascadingPropGeometryResult {
  readonly adjustment: Point;
  readonly matchedKey: string;
}

export interface IPropGeometryAdjustmentRepository {
  readonly isInitialized: boolean;
  initialize(): Promise<void>;
  getAdjustmentCascading(key: PropGeometryKey): CascadingPropGeometryResult | null;
  saveAdjustment(input: PropGeometryAdjustmentInput): Promise<void>;
  dispose(): void;
}
