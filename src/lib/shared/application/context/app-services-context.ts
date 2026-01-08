/**
 * Application Services Context
 *
 * Provides DI-resolved services to all descendant components via Svelte context.
 * This eliminates the need for child components to call resolve() directly.
 *
 * Usage:
 * - In MainApplication: setAppServicesContext({ ... })
 * - In child components: const { settingsService } = getAppServicesContext()
 */

import { getContext, setContext } from "svelte";
import type { ISettingsState } from "../../settings/services/contracts/ISettingsState";
import type { IDeviceDetector } from "../../device/services/contracts/IDeviceDetector";
import type { IHapticFeedback } from "../services/contracts/IHapticFeedback";
import type { ICollaborativeVideoManager } from "../../video-collaboration/services/contracts/ICollaborativeVideoManager";
import type { IUserRepository } from "../../community/services/contracts/IUserRepository";
import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
import type { ICodex } from "$lib/features/learn/codex/services/contracts/ICodex";
// TODO: IQuizRepoManager contract doesn't exist yet - uncomment when created
// import type { IQuizRepoManager } from "$lib/features/learn/quiz/services/contracts/IQuizRepoManager";
import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
import type { IStartPositionManager } from "$lib/features/create/construct/start-position-picker/services/contracts/IStartPositionManager";

const APP_SERVICES_KEY = "app-services";

/**
 * All services available via app context
 */
export interface AppServicesContext {
  // Core services
  settingsService: ISettingsState;
  deviceService: IDeviceDetector;
  hapticService: IHapticFeedback;

  // Feature services (lazy-loaded, may be null initially)
  videoService?: ICollaborativeVideoManager;
  userService?: IUserRepository;
  discoverLoader?: IDiscoverLoader;
  codexService?: ICodex;
  // quizRepo?: IQuizRepoManager; // TODO: uncomment when IQuizRepoManager contract is created
  LOOPTypeResolver?: ILOOPTypeResolver;
  StartPositionManager?: IStartPositionManager;
}

/**
 * Set the app services context (call in MainApplication)
 */
export function setAppServicesContext(services: AppServicesContext): void {
  setContext(APP_SERVICES_KEY, services);
}

/**
 * Get the app services context (call in child components)
 */
export function getAppServicesContext(): AppServicesContext {
  const ctx = getContext<AppServicesContext>(APP_SERVICES_KEY);
  if (!ctx) {
    throw new Error(
      "AppServicesContext not found. Ensure component is a descendant of MainApplication."
    );
  }
  return ctx;
}

/**
 * Try to get app services context (returns undefined if not available)
 */
export function tryGetAppServicesContext(): AppServicesContext | undefined {
  return getContext<AppServicesContext>(APP_SERVICES_KEY);
}
