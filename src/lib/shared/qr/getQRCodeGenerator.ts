import { browser } from '$app/environment';
import type { IQRCodeGenerator } from './services/contracts/IQRCodeGenerator';
import { QRCodeGenerator } from './services/implementations/QRCodeGenerator';
import { getShortCodeManager } from './getShortCodeManager';

let instance: IQRCodeGenerator | null = null;

export function getQRCodeGenerator(): IQRCodeGenerator {
	if (!browser) throw new Error('getQRCodeGenerator() is browser-only');
	return instance ??= new QRCodeGenerator(getShortCodeManager());
}
