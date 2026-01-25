/**
 * QR Container - ITI Dependency Injection
 *
 * Contains QR code generation and URL shortening services:
 * - ShortCodeManager - Firebase-backed URL shortening + offline encoding
 * - QRCodeGenerator - Styled QR code generation with offline support
 */

import { createContainer } from "iti";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
import { QRCodeGenerator } from "$lib/shared/qr/services/implementations/QRCodeGenerator";

/**
 * Dependencies required for the QR container
 */
export interface QRContainerDeps {
  /** For loading full sequence data from Firebase (online mode) */
  browseLoader: IBrowseLoader;
  /** For encoding/decoding sequences (offline mode) */
  sequenceEncoder: ISequenceEncoder;
}

/**
 * Create the QR container with external dependencies
 *
 * @param deps - Required dependencies from other containers
 */
export function createQRContainer(deps: QRContainerDeps) {
  // Layer 1: ShortCodeManager (depends on external browseLoader + sequenceEncoder)
  const baseContainer = createContainer().add({
    shortCodeManager: () =>
      new ShortCodeManager(deps.browseLoader, deps.sequenceEncoder),
  });

  // Layer 2: QRCodeGenerator (depends on shortCodeManager)
  const fullContainer = baseContainer.add((ctx) => ({
    qrCodeGenerator: () => new QRCodeGenerator(ctx.shortCodeManager),
  }));

  return fullContainer;
}

// Type for the QR container
export type QRContainer = ReturnType<typeof createQRContainer>;
