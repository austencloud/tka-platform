import { browser } from '$app/environment';
import { QRCodeGenerator } from './services/qr-code-generator';
import { getShortCodeManager } from './getShortCodeManager';

let instance: QRCodeGenerator | null = null;

export function getQRCodeGenerator(): QRCodeGenerator {
	if (!browser) throw new Error('getQRCodeGenerator() is browser-only');
	return instance ??= new QRCodeGenerator(getShortCodeManager());
}
