import { deviceDetector } from './services/implementations/DeviceDetector';
import type { DeviceDetector } from '$lib/shared/device/services/implementations/DeviceDetector'

/** Returns the module-level DeviceDetector singleton. */
export function getDeviceDetector(): DeviceDetector {
	return deviceDetector;
}
