/**
 * InversifyJS Service Type Identifiers - Unified Export
 *
 * This file aggregates all domain-specific type identifiers into a single TYPES object
 * for backward compatibility while allowing domain-specific imports for better organization.
 *
 * ## Architecture Decision: Why This Structure Exists
 *
 * This is NOT the "Service Locator anti-pattern" - it's an intentional adaptation of
 * InversifyJS for Svelte 5's component model. Here's why:
 *
 * ### The Svelte 5 Constraint
 * Svelte components are NOT classes you instantiate - the framework creates them.
 * This means traditional constructor injection is impossible for components.
 * Your options are:
 *
 * 1. `resolve(TYPES.X)` - Global service locator (what we use)
 * 2. `getContext('service')` - Svelte's built-in pattern (component-tree-scoped locator)
 * 3. Props drilling - Doesn't scale
 * 4. Module singletons - No interface abstraction
 *
 * Options 1 and 2 are structurally identical patterns - the difference is scope.
 * We chose option 1 because:
 * - Services need to be shared across component trees
 * - HMR requires container persistence across hot reloads
 * - Inversify provides proper constructor injection for service-to-service dependencies
 *
 * ### What Inversify Actually Provides
 * For SERVICE-TO-SERVICE dependencies, Inversify uses proper constructor injection
 * via `@inject()` decorators. The "service locator" aspect only exists at the
 * component boundary where Svelte takes over.
 *
 * ### Why the Token Registry is Large
 * Each domain (animation, rendering, generation, etc.) has its own services.
 * The alternative would be tightly coupling components to concrete implementations.
 * The size reflects the application's feature set, not architectural debt.
 *
 * @see docs/architecture/DI-ARCHITECTURE.md for detailed rationale
 */

// Domain-specific imports
import { AdminTypes } from "./admin.types";
import { AnimationTypes } from "./animation.types";
import { ArrowTypes } from "./arrow.types";
import { AudioTypes } from "./audio.types";
import { AuthTypes } from "./auth.types";
import { BackgroundTypes } from "./background.types";
import { ComposeTypes } from "./compose.types";
import { LOOPLabelerTypes } from "./loop-labeler.types";
import { CoreTypes } from "./core.types";
import { CreateTypes } from "./create.types";
import { DiscoverTypes } from "./discover.types";
import { ExportTypes } from "./export.types";
import { FeedbackTypes } from "./feedback.types";
import { GamificationTypes } from "./gamification.types";
import { GenerationTypes } from "./generation.types";
import { LearnTypes } from "./learn.types";
import { LibraryTypes } from "./library.types";
import { MessagingTypes } from "./messaging.types";
import { RenderingTypes } from "./rendering.types";
import { TrainTypes } from "./train.types";
import { UITypes } from "./ui.types";
import { PromoTypes } from "./promo.types";

// Re-export domain-specific types for granular imports
export {
  AdminTypes,
  AnimationTypes,
  ArrowTypes,
  AudioTypes,
  AuthTypes,
  BackgroundTypes,
  ComposeTypes,
  LOOPLabelerTypes,
  CoreTypes,
  CreateTypes,
  DiscoverTypes,
  ExportTypes,
  FeedbackTypes,
  GamificationTypes,
  GenerationTypes,
  LearnTypes,
  LibraryTypes,
  MessagingTypes,
  RenderingTypes,
  TrainTypes,
  UITypes,
  PromoTypes,
};

/**
 * Unified TYPES object for backward compatibility.
 *
 * Prefer importing domain-specific types when possible:
 * ```typescript
 * // Preferred - clearer intent, smaller import
 * import { AnimationTypes } from '$shared/inversify/types';
 * resolve(AnimationTypes.IAnimationPlaybackController);
 *
 * // Also valid - backward compatible
 * import { TYPES } from '$shared/inversify/types';
 * resolve(TYPES.IAnimationPlaybackController);
 * ```
 */
export const TYPES = {
  ...CoreTypes,
  ...AuthTypes,
  ...UITypes,
  ...CreateTypes,
  ...ComposeTypes,
  ...RenderingTypes,
  ...ArrowTypes,
  ...AudioTypes,
  ...DiscoverTypes,
  ...ExportTypes,
  ...GenerationTypes,
  ...AnimationTypes,
  ...BackgroundTypes,
  ...LearnTypes,
  ...TrainTypes,
  ...GamificationTypes,
  ...AdminTypes,
  ...LibraryTypes,
  ...FeedbackTypes,
  ...MessagingTypes,
  ...LOOPLabelerTypes,
  ...PromoTypes,
} as const;

// Type helper for getting service types
export type ServiceType = (typeof TYPES)[keyof typeof TYPES];
