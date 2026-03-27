import type { DetectedEndpoint } from "../../domain/types";
import type { PropTipData } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedTipData, LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailPoint } from "$lib/shared/animation-engine/domain/types/TrailTypes";

export interface IVideoTipAdapter {
  mapToFireTips(endpoints: DetectedEndpoint[], canvasSize: number, currentTime: number): PropTipData[];
  mapToLedTips(endpoints: DetectedEndpoint[], currentTime: number, ledConfig: LedOverlayConfig): LedTipData[];
  mapToTrailPoints(endpoints: DetectedEndpoint[], currentTime: number): TrailPoint[];
  reset(): void;
}
