/**
 * Gallery DI Module
 *
 * Registers all gallery services with the inversify container.
 * Uses safe binding to prevent duplicate bindings during HMR.
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { GALLERY_TYPES } from "./gallery.types";
import { createSafeBinder } from "$lib/shared/inversify/hmr/safeBind";

// Service implementations
import { RoomGeometryGenerator } from "../services/implementations/RoomGeometryGenerator";
import { CollisionWorldBuilder } from "../services/implementations/CollisionWorldBuilder";
import { CollisionResolver } from "../services/implementations/CollisionResolver";
import { ConnectionGeometryGenerator } from "../services/implementations/ConnectionGeometryGenerator";
import { MansionLayoutGenerator } from "../services/implementations/MansionLayoutGenerator";
import { ExhibitLoader } from "../services/implementations/ExhibitLoader";

// Multiplayer services
import { GallerySessionManager } from "../multiplayer/services/implementations/GallerySessionManager";
import { GalleryPositionSyncer } from "../multiplayer/services/implementations/GalleryPositionSyncer";

export const galleryModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Use safe binder to prevent duplicate bindings during HMR
    const bind = createSafeBinder(options);

    // Room geometry generator (singleton - stateless)
    bind(RoomGeometryGenerator)
      .toSelf()
      .inSingletonScope();

    // Collision world builder (singleton - stateless)
    bind(CollisionWorldBuilder)
      .toSelf()
      .inSingletonScope();

    // Collision resolver (singleton - stateless)
    bind(CollisionResolver)
      .toSelf()
      .inSingletonScope();

    // Connection geometry generator (singleton - calculates corridor geometry)
    bind(ConnectionGeometryGenerator)
      .toSelf()
      .inSingletonScope();

    // Layout generator (singleton - uses injected services)
    bind(GALLERY_TYPES.IGalleryLayoutGenerator)
      .to(MansionLayoutGenerator)
      .inSingletonScope();

    // Exhibit loader (singleton - uses injected repository)
    bind(GALLERY_TYPES.IExhibitLoader)
      .to(ExhibitLoader)
      .inSingletonScope();

    // =========================================================================
    // Multiplayer Services
    // =========================================================================

    // Session manager (singleton - manages session state)
    bind(GALLERY_TYPES.IGallerySessionManager)
      .to(GallerySessionManager)
      .inSingletonScope();

    // Position syncer (singleton - handles real-time sync)
    bind(GALLERY_TYPES.IGalleryPositionSyncer)
      .to(GalleryPositionSyncer)
      .inSingletonScope();
  }
);
