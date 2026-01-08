/**
 * Museum Navigator DI Module
 */

import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { createHMRSafeBinder } from "../hmr/safeBind";
import { MUSEUM_TYPES } from "../types/museum.types";
import type { ISequenceCurator } from "$lib/features/museum-navigator/services/contracts/ISequenceCurator";
import { SequenceCurator } from "$lib/features/museum-navigator/services/implementations/SequenceCurator";

export const museumModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    const bind = createHMRSafeBinder(options);

    bind<ISequenceCurator>(MUSEUM_TYPES.ISequenceCurator)
      .to(SequenceCurator)
      .inSingletonScope();
  }
);
