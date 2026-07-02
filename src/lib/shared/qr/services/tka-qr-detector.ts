/**
 * QR detection for printed TKA cards.
 *
 * Wraps the `barcode-detector` ponyfill (ZXing-C++ WebAssembly; delegates to
 * the platform's native BarcodeDetector engine where one exists). The WASM
 * binary is SELF-HOSTED under static/zxing/ — the package's default is a
 * jsDelivr CDN fetch at runtime, which would break offline scanning and tie
 * the feature to a third-party CDN. Same discipline as the Draco decoder in
 * static/draco/.
 */
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";

let prepared = false;

export interface TkaQrDetector {
	/** Raw string contents of every QR found in the frame. */
	detect(frame: ImageData): Promise<string[]>;
}

export function createTkaQrDetector(): TkaQrDetector {
	if (!prepared) {
		prepared = true;
		prepareZXingModule({
			overrides: {
				locateFile: (path: string, prefix: string) =>
					path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path,
			},
		});
	}

	const detector = new BarcodeDetector({ formats: ["qr_code"] });

	return {
		async detect(frame: ImageData): Promise<string[]> {
			const results = await detector.detect(frame);
			return results.map((r) => r.rawValue);
		},
	};
}
