/**
 * App-wide side-effect registrations.
 *
 * Dynamically imported once by +layout.svelte during app init.
 * Replaces the former di/index.ts composition root — all services
 * are now module-level singleton getters; this file only wires
 * cross-cutting late-binding deps that can't be expressed as
 * constructor args.
 */

import { configureShortCodeManager } from "./qr/getShortCodeManager";
import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";
import { getQRCodeGenerator } from "./qr/getQRCodeGenerator";
import { getImageComposer } from "./render/getImageComposer";

if (typeof window !== "undefined") {
	configureShortCodeManager(getBrowseLoader());

	try {
		const composer = getImageComposer();
		if (composer) {
			(
				composer as unknown as {
					setQRCodeGenerator: (g: unknown) => void;
				}
			).setQRCodeGenerator(getQRCodeGenerator());
		}
	} catch {
		// ImageComposer not yet initialized — QR injection deferred to first use
	}
}
