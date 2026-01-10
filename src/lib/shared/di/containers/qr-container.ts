/**
 * QR Container - ITI Dependency Injection
 *
 * Contains QR code generation and URL shortening services:
 * - ShortCodeManager - Firebase-backed URL shortening
 * - QRCodeGenerator - Styled QR code generation
 */

import { createContainer } from "iti";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
import { QRCodeGenerator } from "$lib/shared/qr/services/implementations/QRCodeGenerator";

/**
 * Create the QR container with external dependencies
 *
 * @param sequenceEncoder - Required dependency from navigation module
 */
export function createQRContainer(sequenceEncoder: ISequenceEncoder) {
  // Layer 1: ShortCodeManager (depends on external sequenceEncoder)
  const baseContainer = createContainer().add({
    shortCodeManager: () => new ShortCodeManager(sequenceEncoder),
  });

  // Layer 2: QRCodeGenerator (depends on shortCodeManager)
  const fullContainer = baseContainer.add((ctx) => ({
    qrCodeGenerator: () => new QRCodeGenerator(ctx.shortCodeManager),
  }));

  return fullContainer;
}

// Type for the QR container
export type QRContainer = ReturnType<typeof createQRContainer>;
