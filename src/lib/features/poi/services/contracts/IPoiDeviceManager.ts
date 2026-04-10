import type { IPoiDeviceAdapter, IPoiConnection } from "./IPoiDeviceAdapter";
import type { PoiDeviceInfo } from "../../domain/DeviceTypes";
import type { StripPattern } from "../../domain/StripPattern";

export interface IPoiDeviceManager {
  /** All registered adapters */
  readonly adapters: IPoiDeviceAdapter[];

  /** Currently active connections */
  readonly connections: IPoiConnection[];

  /** Trigger scan on all adapters, returns discovered devices */
  scanAll(): Promise<PoiDeviceInfo[]>;

  /** Connect to a specific device via the appropriate adapter */
  connect(device: PoiDeviceInfo): Promise<IPoiConnection>;

  /** Disconnect a specific device */
  disconnect(deviceId: string): void;

  /** Upload pattern to a specific connected device */
  uploadPattern(
    deviceId: string,
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;

  /** Upload pattern to ALL connected devices simultaneously */
  uploadToAll(
    pattern: StripPattern,
    slot: number,
    onProgress?: (pct: number) => void
  ): Promise<void>;
}
