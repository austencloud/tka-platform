/**
 * QR Module - InversifyJS Container Module
 *
 * Binds QR code generation and URL shortening services for dependency injection.
 * Uses factory functions for manual instantiation (no decorators required).
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { QRCodeGenerator } from "../../qr/services/implementations/QRCodeGenerator";
import { ShortCodeManager } from "../../qr/services/implementations/ShortCodeManager";
import type { ISequenceEncoder } from "../../navigation/services/contracts/ISequenceEncoder";
import type { IShortCodeManager } from "../../qr/services/contracts/IShortCodeManager";
import { TYPES } from "../types";

// Singleton instances for manual DI (no decorators)
let shortCodeManagerInstance: ShortCodeManager | null = null;
let qrCodeGeneratorInstance: QRCodeGenerator | null = null;

export const qrModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Short code manager - singleton for Firebase connection reuse
    options
      .bind<IShortCodeManager>(TYPES.IShortCodeManager)
      .toProvider(() => {
        return async () => {
          if (!shortCodeManagerInstance) {
            // Lazy resolution of dependency
            const { getContainerInstance } = await import("../di");
            const container = await getContainerInstance();
            const sequenceEncoder = container.get<ISequenceEncoder>(TYPES.ISequenceEncoder);
            shortCodeManagerInstance = new ShortCodeManager(sequenceEncoder);
          }
          return shortCodeManagerInstance;
        };
      });

    // QR code generator - factory with lazy ShortCodeManager resolution
    options
      .bind(TYPES.IQRCodeGenerator)
      .toProvider(() => {
        return async () => {
          if (!qrCodeGeneratorInstance) {
            const { getContainerInstance } = await import("../di");
            const container = await getContainerInstance();
            const shortCodeManager = container.get<IShortCodeManager>(TYPES.IShortCodeManager);
            // Since ShortCodeManager is now a provider, we need to call it
            const resolvedManager = typeof shortCodeManager === 'function'
              ? await (shortCodeManager as () => Promise<IShortCodeManager>)()
              : shortCodeManager;
            qrCodeGeneratorInstance = new QRCodeGenerator(resolvedManager);
          }
          return qrCodeGeneratorInstance;
        };
      });
  }
);
