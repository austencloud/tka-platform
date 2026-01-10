/**
 * QR Container - ITI Dependency Injection
 *
 * Contains QR code generation and URL shortening services:
 * - ShortCodeManager - Firebase-backed URL shortening
 * - QRCodeGenerator - Styled QR code generation
 */

import { createContainer } from "iti";
import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
import { QRCodeGenerator } from "$lib/shared/qr/services/implementations/QRCodeGenerator";

/**
 * Create the QR container with external dependencies
 *
 * @param discoverLoader - Required dependency from discover module (for loading full sequence data)
 */
export function createQRContainer(discoverLoader: IDiscoverLoader) {
  // Layer 1: ShortCodeManager (depends on external discoverLoader)
  const baseContainer = createContainer().add({
    shortCodeManager: () => new ShortCodeManager(discoverLoader),
  });

  // Layer 2: QRCodeGenerator (depends on shortCodeManager)
  const fullContainer = baseContainer.add((ctx) => ({
    qrCodeGenerator: () => new QRCodeGenerator(ctx.shortCodeManager),
  }));

  return fullContainer;
}

// Type for the QR container
export type QRContainer = ReturnType<typeof createQRContainer>;
