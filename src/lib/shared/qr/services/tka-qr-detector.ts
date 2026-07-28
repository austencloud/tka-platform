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

export interface TkaQrDetection {
	/** Raw string contents of the QR. */
	rawValue: string;
	/**
	 * Where the QR sits in the source's own pixel space (the ImageData/Blob/File
	 * handed to detect). The scan sheet uses this to lift the actual QR pixels
	 * out of the frame for the capture animation.
	 */
	boundingBox: { x: number; y: number; width: number; height: number };
}

export interface TkaQrDetector {
	/**
	 * Every QR found in the source, with its location.
	 *
	 * Accepts anything the underlying ponyfill accepts - an ImageData frame
	 * from the camera (ScanCardSheet), or a Blob/File straight off disk (share
	 * intake). Do NOT decode a File to ImageData by hand before calling this:
	 * zxing-wasm decodes a Blob internally and the canvas round trip is pure
	 * cost.
	 */
	detect(source: ImageBitmapSource): Promise<TkaQrDetection[]>;
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
		async detect(source: ImageBitmapSource): Promise<TkaQrDetection[]> {
			const results = await detector.detect(source);
			return results.map((r) => ({
				rawValue: r.rawValue,
				boundingBox: {
					x: r.boundingBox.x,
					y: r.boundingBox.y,
					width: r.boundingBox.width,
					height: r.boundingBox.height,
				},
			}));
		},
	};
}
