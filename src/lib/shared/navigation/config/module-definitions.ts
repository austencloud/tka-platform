/**
 * Module Definitions
 *
 * Defines all application modules with their metadata.
 * Separated from state management for cleaner architecture.
 */

import type { ModuleDefinition, ModuleId } from "../domain/types";
import {
  CREATE_TABS,
  LEARN_TABS,
  BROWSE_TABS,
  COMPOSE_TABS,
  TRAIN_TABS,
  FEEDBACK_TABS,
  ADMIN_TABS,
  SETTINGS_TABS,
  WATCH_TABS,
  LAB_TABS,
  ARENA_TABS,
  CHOREO_CARD_TABS,
  FESTIVAL_TABS,
} from "./tab-definitions";

/**
 * Migration map for renamed module IDs.
 * Maps old (invalid) module IDs to their current canonical form.
 * Used to handle stale data from localStorage/Firestore.
 */
const MODULE_ID_MIGRATIONS: Record<string, ModuleId> = {
  TIKA: "tika", // Module renamed back to lowercase for cleaner URLs
  discover: "browse", // Module renamed from Discover to Browse (Jan 2026)
  explore: "browse", // Module renamed from Explore to Browse (Jan 2026)
  dashboard: "create", // Dashboard removed - Create is now the default landing (Jan 2026)
  // Experimental modules consolidated into Lab (Jan 2026)
  skewlab: "lab",
  "poi-lab": "lab",
  "terrain-research": "lab",
  mandala: "lab",
  "background-builder": "lab",
  "landing-preview": "lab",
  // Standalone modules consolidated into Lab (Feb 2026)
  "ml-training": "lab",
  community: "lab",
  connect: "lab",
};

/**
 * Normalize a module ID from potentially stale persisted data.
 * Returns the canonical module ID if valid, or undefined if unknown.
 */
export function normalizeModuleId(rawModuleId: string): ModuleId | undefined {
  // Check if it's a known migration
  const migrated = MODULE_ID_MIGRATIONS[rawModuleId];
  if (migrated) {
    return migrated;
  }

  // Check if it's already a valid module ID
  const isValid = MODULE_DEFINITIONS.some((m) => m.id === rawModuleId);
  if (isValid) {
    return rawModuleId as ModuleId;
  }

  return undefined;
}

// Module definitions for the new navigation system
// NOTE: Dashboard removed - it was a redundant launcher. Create is now the default landing.
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "create",
    label: "Create",
    icon: '<i class="fas fa-tools" style="color: #f59e0b;" aria-hidden="true"></i>',
    color: "#f59e0b", // Amber - construction/creation
    description: "Construct and generate sequences",
    isMain: true,
    sections: CREATE_TABS,
  },
  {
    id: "browse",
    label: "Browse",
    icon: '<i class="fas fa-compass" style="color: #a855f7;" aria-hidden="true"></i>',
    color: "#a855f7", // Purple - browsing
    description: "Browse sequences and creators",
    isMain: true,
    sections: BROWSE_TABS,
  },
  // community module consolidated into Lab (Feb 2026)
  {
    id: "learn",
    label: "Learn",
    icon: '<i class="fas fa-graduation-cap" style="color: #3b82f6;" aria-hidden="true"></i>',
    color: "#3b82f6", // Blue - education/knowledge
    description: "Study and practice TKA",
    isMain: true,
    sections: LEARN_TABS,
  },
  {
    id: "tika",
    label: "Tika",
    icon: '<i class="fas fa-brain" style="color: #6366f1;" aria-hidden="true"></i>',
    color: "#6366f1", // Indigo - AI/assistant
    description: "AI tutor for learning TKA",
    isMain: true,
    sections: [], // Single-tab module
  },
  {
    id: "premium",
    label: "Go Premium",
    icon: '<i class="fas fa-crown" style="color: #fbbf24;" aria-hidden="true"></i>',
    color: "#fbbf24", // Gold - premium/upgrade
    description: "Support TKA and unlock premium features",
    isMain: true, // Visibility controlled by getModuleDefinitions() - only shown to non-premium users
    sections: [], // Single-tab module - no sub-tabs
  },
  {
    id: "compose",
    label: "Compose",
    icon: '<i class="fas fa-photo-film" style="color: #ec4899;" aria-hidden="true"></i>',
    color: "#ec4899", // Pink - composition/choreography
    description: "Compose sequences into animations",
    isMain: true,
    sections: COMPOSE_TABS, // TODO: Rename to COMPOSE_TABS
  },
  {
    id: "watch",
    label: "Watch",
    icon: '<i class="fas fa-play-circle" style="color: #ef4444;" aria-hidden="true"></i>',
    color: "#ef4444", // Red - video/playback
    description: "Browse videos from the community",
    isMain: true,
    sections: WATCH_TABS,
    // Feed tab now has TikTok-style scroll experience
  },
  {
    id: "arena",
    label: "Arena",
    icon: '<i class="fas fa-trophy" style="color: #e11d48;" aria-hidden="true"></i>',
    color: "#e11d48", // Rose - competition
    description: "Vote on head-to-head sequence matchups",
    isMain: true,
    sections: ARENA_TABS,
  },
  // connect module consolidated into Lab (Feb 2026)
  {
    id: "train",
    label: "Train",
    icon: '<i class="fas fa-running" style="color: #ef4444;" aria-hidden="true"></i>',
    color: "#ef4444", // Red - action/training
    description: "Practice with real-time scoring",
    isMain: true,
    sections: TRAIN_TABS,
  },
  // REMOVED: Library module - functionality now integrated into Browse > Gallery via scope toggle
  // Removed: inbox module (Messages/notifications accessible via Dashboard widget drawer)
  // Removed: account module (merged into Dashboard - profile widget handles auth)
  // Removed: edit module (Edit functionality is now a slide-out panel accessible from Create and Sequence Viewer)
  // Removed: about module (content moved to Dashboard > Support widget)
  {
    id: "choreo_card",
    label: "Choreo Cards",
    icon: '<i class="fas fa-id-card" style="color: #6366f1;" aria-hidden="true"></i>',
    color: "#6366f1", // Indigo - flashcards/learning
    description: "Browse choreography as printable reference cards",
    isMain: true,
    sections: CHOREO_CARD_TABS,
  },
  {
    id: "write",
    label: "Write",
    icon: '<i class="fas fa-pen-nib" style="color: #f43f5e;" aria-hidden="true"></i>',
    color: "#f43f5e", // Rose - creative writing/composition
    description: "Create and edit choreography acts",
    isMain: true,
    sections: [], // Single-tab module
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: '<i class="fas fa-comment-dots" style="color: #14b8a6;" aria-hidden="true"></i>',
    color: "#14b8a6", // Teal - feedback/communication
    description: "Submit and manage feedback",
    isMain: true, // Visibility controlled by getModuleDefinitions() based on tester status
    sections: FEEDBACK_TABS,
  },
  {
    id: "moderation",
    label: "Moderation",
    icon: '<i class="fas fa-shield-halved" style="color: #ef4444;" aria-hidden="true"></i>',
    color: "#ef4444", // Red - moderation/safety
    description: "Review and manage user reports",
    isMain: true,
    sections: [], // Single-tab module
    adminOnly: true, // Admin-only
  },
  // ml-training module consolidated into Lab (Feb 2026)
  {
    id: "admin",
    label: "Admin",
    icon: '<i class="fas fa-crown" style="color: #ffd700;" aria-hidden="true"></i>',
    color: "#ffd700", // Gold - admin/privileged
    description: "System management & configuration",
    isMain: true, // Visibility controlled by getModuleDefinitions() based on admin status
    sections: ADMIN_TABS,
  },
  {
    id: "festivals",
    label: "Festivals",
    icon: '<i class="fas fa-fire" style="color: #f97316;" aria-hidden="true"></i>',
    color: "#f97316",
    description: "Discover and apply to flow festivals",
    isMain: true,
    sections: FESTIVAL_TABS,
  },
  {
    id: "realm",
    label: "Realm",
    icon: '<i class="fas fa-vr-cardboard" style="color: #06b6d4;" aria-hidden="true"></i>',
    color: "#06b6d4",
    description: "3D destinations: museum, stage, gallery, procedural worlds",
    isMain: true,
    sections: [],
  },
  {
    id: "retro",
    label: "Retro",
    icon: '<i class="fas fa-desktop" style="color: #008080;" aria-hidden="true"></i>',
    color: "#008080",
    description: "TKA-OS: Win95 desktop, DOS terminal, and pixel pictographs",
    isMain: true,
    sections: [],
  },
  {
    id: "lab",
    label: "Lab",
    icon: '<i class="fas fa-flask" style="color: #10b981;" aria-hidden="true"></i>',
    color: "#10b981", // Emerald - experimental
    description: "Temporary experiments and UI prototypes",
    isMain: true,
    sections: LAB_TABS,
    adminOnly: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: '<i class="fas fa-cog" style="color: #64748b;" aria-hidden="true"></i>',
    color: "#64748b", // Slate - neutral settings color
    description: "Configure app preferences",
    isMain: false, // Settings is in sidebar footer, not main module list
    sections: SETTINGS_TABS, // Profile, Props, Background, Visibility, Misc, AI tabs
  },
  // ============================================================================
  // REMOVED: Standalone 3D modules (now unified under Realm)
  // ============================================================================
  // - infinite-worlds → Now accessible via Realm destination picker
  // - museum → Now accessible via Realm destination picker (Gallery destination)
  // - gallery3d → Retired, merged into Gallery destination
  // - 3d-viewer → Retired, merged into Stage destination
];
