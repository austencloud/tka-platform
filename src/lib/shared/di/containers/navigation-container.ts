/**
 * Navigation Container
 *
 * ITI container for all navigation-related services.
 * Replaces the Inversify navigationModule.
 *
 * Dependencies:
 * - External deps (MotionQueryHandler, GridModeDeriver, GridPositionDeriver, PersistenceService)
 *   must be provided from the parent container
 */

import { createContainer } from "iti";

// Service implementations
import { KeyboardNavigator } from "../../navigation/services/KeyboardNavigator";
import { ModuleSelector } from "../../navigation/services/ModuleSelector";
import { SheetRouter } from "../../navigation/services/implementations/SheetRouter";
import { SequenceEncoder } from "../../navigation/services/implementations/SequenceEncoder";
import { URLSyncer } from "../../navigation/services/implementations/URLSyncer";
import { DeepLinker } from "../../navigation/services/implementations/DeepLinker";
import { LetterDeriver } from "../../navigation/services/implementations/LetterDeriver";
import { PositionDeriver } from "../../navigation/services/implementations/PositionDeriver";
import { SequenceViewer } from "../../sequence-viewer/services/implementations/SequenceViewer";
import { PublicSequenceHashMatcher } from "../../sequence-viewer/services/implementations/PublicSequenceHashMatcher";
import { NavigationValidator } from "../../navigation/services/implementations/NavigationValidator";
import { SidebarTabToggler } from "../../navigation/services/implementations/SidebarTabToggler";

// Types for external dependencies
import type { IMotionQueryHandler } from "../../foundation/services/contracts/data/data-contracts";
import type { IGridModeDeriver } from "../../pictograph/grid/services/contracts/IGridModeDeriver";
import type { IGridPositionDeriver } from "../../pictograph/grid/services/contracts/IGridPositionDeriver";
import type { IPersistenceService } from "../../persistence/services/contracts/IPersistenceService";

/**
 * External dependencies that must be provided from the parent container
 */
export interface NavigationExternalDeps {
  motionQueryHandler: IMotionQueryHandler | null;
  gridModeDeriver: IGridModeDeriver | null;
  gridPositionDeriver: IGridPositionDeriver | null;
  persistenceService: IPersistenceService;
}

/**
 * Create the navigation container with external dependencies injected
 */
export function createNavigationContainer(externalDeps: NavigationExternalDeps) {
  return createContainer()
    // === Services with no dependencies ===
    .add({
      keyboardNavigator: () => new KeyboardNavigator(),
      moduleSelector: () => new ModuleSelector(),
      sheetRouter: () => new SheetRouter(),
      sequenceEncoder: () => new SequenceEncoder(),
      navigationValidator: () => new NavigationValidator(),
      sidebarTabToggler: () => new SidebarTabToggler(),
    })
    // === Services that depend on SequenceEncoder ===
    .add((ctx) => ({
      urlSyncer: () => new URLSyncer(ctx.sequenceEncoder),
      deepLinker: () => new DeepLinker(ctx.sequenceEncoder),
      publicSequenceHashMatcher: () =>
        new PublicSequenceHashMatcher(ctx.sequenceEncoder),
    }))
    // === Services that depend on external services ===
    .add((ctx) => ({
      letterDeriver: () =>
        new LetterDeriver(
          externalDeps.motionQueryHandler,
          externalDeps.gridModeDeriver
        ),
      positionDeriver: () =>
        new PositionDeriver(externalDeps.gridPositionDeriver),
      sequenceViewer: () =>
        new SequenceViewer(
          externalDeps.persistenceService,
          ctx.sequenceEncoder
        ),
    }));
}

/**
 * Type representing all services provided by this container
 */
export type NavigationContainerItems = ReturnType<
  typeof createNavigationContainer
>["items"];
