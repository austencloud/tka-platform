/**
 * Dashboard Configuration
 * Constants, gradients, and configuration for dashboard rendering
 */

import type { ModuleId } from "$lib/shared/navigation/domain/types";
import {
  DURATION,
  STAGGER,
  SLIDE,
} from "$lib/shared/transitions/transitions";

export const MODULE_GRADIENTS: Record<ModuleId | string, string> = {
  create: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  browse: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  learn: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  animate: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
  train: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  feedback: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  admin: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
  "ml-training": "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  settings: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
};

/** @deprecated Import DURATION, STAGGER, SLIDE directly from '$lib/shared/transitions/transitions' */
export const ANIMATION_CONSTANTS = { DURATION, STAGGER, SLIDE };

export function getModuleGradient(id: ModuleId | string): string {
  return (
    MODULE_GRADIENTS[id] || "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
  );
}
