/**
 * Gallery DI Module
 *
 * Registers all gallery services with the inversify container.
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { GALLERY_TYPES } from "./gallery.types";

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
    // Room geometry generator (singleton - stateless)
    options
      .bind(RoomGeometryGenerator)
      .toSelf()
      .inSingletonScope();

    // Collision world builder (singleton - stateless)
    options
      .bind(CollisionWorldBuilder)
      .toSelf()
      .inSingletonScope();

    // Collision resolver (singleton - stateless)
    options
      .bind(CollisionResolver)
      .toSelf()
      .inSingletonScope();

    // Connection geometry generator (singleton - calculates corridor geometry)
    options
      .bind(ConnectionGeometryGenerator)
      .toSelf()
      .inSingletonScope();

    // Layout generator (singleton - uses injected services)
    options
      .bind(GALLERY_TYPES.IGalleryLayoutGenerator)
      .to(MansionLayoutGenerator)
      .inSingletonScope();

    // Exhibit loader (singleton - uses injected repository)
    options
      .bind(GALLERY_TYPES.IExhibitLoader)
      .to(ExhibitLoader)
      .inSingletonScope();

    // =========================================================================
    // Multiplayer Services
    // =========================================================================

    // Session manager (singleton - manages session state)
    options
      .bind(GALLERY_TYPES.IGallerySessionManager)
      .to(GallerySessionManager)
      .inSingletonScope();

    // Position syncer (singleton - handles real-time sync)
    options
      .bind(GALLERY_TYPES.IGalleryPositionSyncer)
      .to(GalleryPositionSyncer)
      .inSingletonScope();
  }
);
