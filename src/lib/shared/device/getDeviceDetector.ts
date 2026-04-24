import { deviceDetector } from './services/implementations/DeviceDetector';
import type { IDeviceDetector } from './services/contracts/IDeviceDetector';

/** Returns the module-level DeviceDetector singleton. */
export function getDeviceDetector(): IDeviceDetector {
	return deviceDetector;
}
