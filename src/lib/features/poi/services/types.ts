import type { PoiDeviceInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "$lib/shared/poi/domain/StripPattern";

export interface IPoiConnection {
  readonly deviceInfo: PoiDeviceInfo;
  readonly connected: boolean;
  uploadPattern(
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;
  setBrightness(level: number): Promise<void>;
  setSpeed(hz: number): Promise<void>;
  disconnect(): void;
}
