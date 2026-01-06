/**
 * Gallery DI Module
 *
 * Registers all gallery services with the inversify container.
 */

import type { ContainerModuleLoadOptions } from "inversify";
import { ContainerModule } from "inversify";
import { GALLERY_TYPES } from "./gallery.types";

// Service implementations
import { HallwayLayoutGenerator } from "../services/implementations/HallwayLayoutGenerator";
import { ExhibitLoader } from "../services/implementations/ExhibitLoader";

export const galleryModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    // Layout generator (singleton - stateless)
    options
      .bind(GALLERY_TYPES.IGalleryLayoutGenerator)
      .to(HallwayLayoutGenerator)
      .inSingletonScope();

    // Exhibit loader (singleton - uses injected repository)
    options
      .bind(GALLERY_TYPES.IExhibitLoader)
      .to(ExhibitLoader)
      .inSingletonScope();
  }
);
