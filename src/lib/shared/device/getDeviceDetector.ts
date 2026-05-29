import { deviceDetector } from './services/device-detector';
import type { DeviceDetector } from '$lib/shared/device/services/device-detector'

/** Returns the module-level DeviceDetector singleton. */
export function getDeviceDetector(): DeviceDetector {
	return deviceDetector;
}
