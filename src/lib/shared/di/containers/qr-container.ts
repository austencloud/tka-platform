/**
 * QR Container - ITI Dependency Injection
 *
 * Contains QR code generation and URL shortening services:
 * - ShortCodeManager - Firebase-backed URL shortening
 * - QRCodeGenerator - Styled QR code generation
 */

import { createContainer } from "iti";
import type { IExploreLoader } from "$lib/features/explore/sequences/display/services/contracts/IExploreLoader";
import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
import { QRCodeGenerator } from "$lib/shared/qr/services/implementations/QRCodeGenerator";

/**
 * Create the QR container with external dependencies
 *
 * @param exploreLoader - Required dependency from discover module (for loading full sequence data)
 */
export function createQRContainer(exploreLoader: IExploreLoader) {
  // Layer 1: ShortCodeManager (depends on external exploreLoader)
  const baseContainer = createContainer().add({
    shortCodeManager: () => new ShortCodeManager(exploreLoader),
  });

  // Layer 2: QRCodeGenerator (depends on shortCodeManager)
  const fullContainer = baseContainer.add((ctx) => ({
    qrCodeGenerator: () => new QRCodeGenerator(ctx.shortCodeManager),
  }));

  return fullContainer;
}

// Type for the QR container
export type QRContainer = ReturnType<typeof createQRContainer>;
