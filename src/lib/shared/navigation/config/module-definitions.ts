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
  RETRO_TABS,
  ARCHIVE_TABS,
  LEVELS_TABS,
  HAND_PATH_TABS,
  VIDEO_TABS,
  SOCIAL_TABS,
  STAGE_TABS,
  MANDALA_TABS,
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
  // Experimental modules consolidated into Lab (Jan 2026), then graduated to Levels (Mar 2026)
  skewlab: "levels",
  "poi-lab": "levels",
  // Museum renamed from museum-2d to museum (Mar 2026)
  "museum-2d": "museum",
  // Realm module dissolved (Apr 2026) - deep links redirect to museum (the most
  // polished former destination). Campground + 3D Controls moved to Lab;
  // Archive promoted to its own main module.
  realm: "museum",
  "mandala-generator": "mandala",
  "mandala-collection": "mandala",
  "background-builder": "lab",
  "landing-preview": "lab",
  // ml-training removed (Mar 2026)
  community: "social",
  connect: "social",
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
    labelKey: "module_create",
    descKey: "module_desc_create",
    label: "Create",
    icon: '<i class="fas fa-tools" style="color: #f59e0b;" aria-hidden="true"></i>',
    color: "#f59e0b", // Amber - construction/creation
    description: "Construct and generate sequences",
    isMain: true,
    sections: CREATE_TABS,
  },
  {
    id: "browse",
    labelKey: "module_browse",
    descKey: "module_desc_browse",
    label: "Browse",
    icon: '<i class="fas fa-compass" style="color: #a855f7;" aria-hidden="true"></i>',
    color: "#a855f7", // Purple - browsing
    description: "Browse sequences and creators",
    isMain: true,
    sections: BROWSE_TABS,
  },
  {
    id: "social",
    labelKey: "module_social",
    descKey: "module_desc_social",
    label: "Social",
    icon: '<i class="fas fa-users" style="color: #14b8a6;" aria-hidden="true"></i>',
    color: "#14b8a6",
    description: "Community map and nearby spinner sync",
    isMain: true,
    sections: SOCIAL_TABS,
  },
  {
    id: "learn",
    labelKey: "module_learn",
    descKey: "module_desc_learn",
    label: "Learn",
    icon: '<i class="fas fa-graduation-cap" style="color: #3b82f6;" aria-hidden="true"></i>',
    color: "#3b82f6", // Blue - education/knowledge
    description: "Study and practice TKA",
    isMain: true,
    sections: LEARN_TABS,
  },
  {
    id: "tika",
    labelKey: "module_tika",
    descKey: "module_desc_tika",
    label: "Tika",
    icon: '<i class="fas fa-brain" style="color: #6366f1;" aria-hidden="true"></i>',
    color: "#6366f1", // Indigo - AI/assistant
    description: "AI tutor for learning TKA",
    isMain: true,
    sections: [], // Single-tab module
  },
  {
    id: "premium",
    labelKey: "module_premium",
    descKey: "module_desc_premium",
    label: "Go Premium",
    icon: '<i class="fas fa-crown" style="color: #fbbf24;" aria-hidden="true"></i>',
    color: "#fbbf24", // Gold - premium/upgrade
    description: "Support TKA and unlock premium features",
    isMain: true, // Visibility controlled by getModuleDefinitions() - only shown to non-premium users
    sections: [], // Single-tab module - no sub-tabs
  },
  {
    id: "compose",
    labelKey: "module_compose",
    descKey: "module_desc_compose",
    label: "Compose",
    icon: '<i class="fas fa-photo-film" style="color: #ec4899;" aria-hidden="true"></i>',
    color: "#ec4899", // Pink - composition/choreography
    description: "Compose sequences into animations",
    isMain: true,
    sections: COMPOSE_TABS, // TODO: Rename to COMPOSE_TABS
  },
  {
    id: "mandala",
    labelKey: "module_mandala",
    descKey: "module_desc_mandala",
    label: "Mandala",
    icon: '<i class="fas fa-dharmachakra" style="color: #f472b6;" aria-hidden="true"></i>',
    color: "#f472b6",
    description: "Create, collect, and meditate with mandalas",
    isMain: true,
    sections: MANDALA_TABS,
  },
  {
    id: "watch",
    labelKey: "module_watch",
    descKey: "module_desc_watch",
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
    labelKey: "module_arena",
    descKey: "module_desc_arena",
    label: "Arena",
    icon: '<i class="fas fa-trophy" style="color: #e11d48;" aria-hidden="true"></i>',
    color: "#e11d48", // Rose - competition
    description: "Vote on head-to-head sequence matchups",
    isMain: true,
    sections: ARENA_TABS,
  },
  {
    id: "train",
    labelKey: "module_train",
    descKey: "module_desc_train",
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
    labelKey: "module_choreo_card",
    descKey: "module_desc_choreo_card",
    label: "Choreo Cards",
    icon: '<i class="fas fa-id-card" style="color: #6366f1;" aria-hidden="true"></i>',
    color: "#6366f1", // Indigo - flashcards/learning
    description: "Browse choreography as printable reference cards",
    isMain: true,
    sections: CHOREO_CARD_TABS,
  },
  {
    id: "write",
    labelKey: "module_write",
    descKey: "module_desc_write",
    label: "Write",
    icon: '<i class="fas fa-pen-nib" style="color: #f43f5e;" aria-hidden="true"></i>',
    color: "#f43f5e", // Rose - creative writing/composition
    description: "Create and edit choreography acts",
    isMain: true,
    sections: [], // Single-tab module
  },
  {
    id: "feedback",
    labelKey: "module_feedback",
    descKey: "module_desc_feedback",
    label: "Feedback",
    icon: '<i class="fas fa-comment-dots" style="color: #14b8a6;" aria-hidden="true"></i>',
    color: "#14b8a6", // Teal - feedback/communication
    description: "Submit and manage feedback",
    isMain: true, // Visibility controlled by getModuleDefinitions() based on tester status
    sections: FEEDBACK_TABS,
  },
  {
    id: "moderation",
    labelKey: "module_moderation",
    descKey: "module_desc_moderation",
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
    labelKey: "module_admin",
    descKey: "module_desc_admin",
    label: "Admin",
    icon: '<i class="fas fa-crown" style="color: #ffd700;" aria-hidden="true"></i>',
    color: "#ffd700", // Gold - admin/privileged
    description: "System management & configuration",
    isMain: true,
    sections: ADMIN_TABS,
    adminOnly: true,
  },
  {
    id: "festivals",
    labelKey: "module_festivals",
    descKey: "module_desc_festivals",
    label: "Festivals",
    icon: '<i class="fas fa-fire" style="color: #f97316;" aria-hidden="true"></i>',
    color: "#f97316",
    description: "Discover and apply to flow festivals",
    isMain: true,
    sections: FESTIVAL_TABS,
  },
  {
    id: "museum",
    labelKey: "module_museum",
    descKey: "module_desc_museum",
    label: "Museum",
    icon: '<i class="fas fa-landmark" style="color: #f59e0b;" aria-hidden="true"></i>',
    color: "#f59e0b",
    description: "Explore The Kinetic Archive - walk the museum, flip into 3D",
    isMain: true,
    sections: ARCHIVE_TABS,
  },
  {
    id: "archive",
    labelKey: "module_archive",
    descKey: "module_desc_archive",
    label: "Archive",
    icon: '<i class="fas fa-scroll" style="color: #c8a050;" aria-hidden="true"></i>',
    color: "#c8a050",
    description: "Walk through 40,000 years of kinetic history",
    isMain: true,
    sections: [],
  },
  {
    id: "retro",
    labelKey: "module_retro",
    descKey: "module_desc_retro",
    label: "Retro",
    icon: '<i class="fas fa-desktop" style="color: #008080;" aria-hidden="true"></i>',
    color: "#008080",
    description: "1989 DOS terminal, 1995 Win95 desktop, pictograph timeline",
    isMain: true,
    sections: RETRO_TABS,
  },
  {
    id: "levels",
    labelKey: "module_levels",
    descKey: "module_desc_levels",
    label: "Levels",
    icon: '<i class="fas fa-layer-group" style="color: #8b5cf6;" aria-hidden="true"></i>',
    color: "#8b5cf6",
    description: "Level 4-7 position labs and poi constraints",
    isMain: true,
    sections: LEVELS_TABS,
  },
  {
    id: "hand-paths",
    labelKey: "module_hand_paths",
    descKey: "module_desc_hand_paths",
    label: "Hand Paths",
    icon: '<i class="fas fa-route" style="color: #10b981;" aria-hidden="true"></i>',
    color: "#10b981",
    description: "Browse and build spatial hand paths",
    isMain: true,
    sections: HAND_PATH_TABS,
  },
  {
    id: "video",
    labelKey: "module_video",
    descKey: "module_desc_video",
    label: "Video",
    icon: '<i class="fas fa-film" style="color: #f43f5e;" aria-hidden="true"></i>',
    color: "#f43f5e",
    description: "Video analysis, trails, effects, and notation extraction",
    isMain: true,
    sections: VIDEO_TABS,
  },
  {
    id: "stage",
    labelKey: "module_stage",
    descKey: "module_desc_stage",
    label: "Stage",
    icon: '<i class="fas fa-people-group" style="color: #06b6d4;" aria-hidden="true"></i>',
    color: "#06b6d4",
    description: "Choreograph multi-performer formations on stage",
    isMain: true,
    sections: STAGE_TABS,
  },
  {
    id: "lab",
    labelKey: "module_lab",
    descKey: "module_desc_lab",
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
    labelKey: "module_settings",
    descKey: "module_desc_settings",
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

const FEATURE_ENABLED: Record<string, boolean> = {
  create: true,
  browse: true,
  feedback: true,
  social: typeof __FEATURE_SOCIAL__ !== "undefined" ? __FEATURE_SOCIAL__ : true,
  learn: typeof __FEATURE_LEARN__ !== "undefined" ? __FEATURE_LEARN__ : true,
  tika: typeof __FEATURE_TIKA__ !== "undefined" ? __FEATURE_TIKA__ : true,
  premium: typeof __FEATURE_PREMIUM__ !== "undefined" ? __FEATURE_PREMIUM__ : true,
  compose: typeof __FEATURE_COMPOSE__ !== "undefined" ? __FEATURE_COMPOSE__ : true,
  watch: typeof __FEATURE_WATCH__ !== "undefined" ? __FEATURE_WATCH__ : true,
  arena: typeof __FEATURE_ARENA__ !== "undefined" ? __FEATURE_ARENA__ : true,
  train: typeof __FEATURE_TRAIN__ !== "undefined" ? __FEATURE_TRAIN__ : true,
  choreo_card: typeof __FEATURE_CHOREO_CARD__ !== "undefined" ? __FEATURE_CHOREO_CARD__ : true,
  write: typeof __FEATURE_WRITE__ !== "undefined" ? __FEATURE_WRITE__ : true,
  moderation: typeof __FEATURE_MODERATION__ !== "undefined" ? __FEATURE_MODERATION__ : true,
  admin: typeof __FEATURE_ADMIN__ !== "undefined" ? __FEATURE_ADMIN__ : true,
  festivals: typeof __FEATURE_FESTIVALS__ !== "undefined" ? __FEATURE_FESTIVALS__ : true,
  museum: typeof __FEATURE_MUSEUM__ !== "undefined" ? __FEATURE_MUSEUM__ : true,
  archive: typeof __FEATURE_ARCHIVE__ !== "undefined" ? __FEATURE_ARCHIVE__ : true,
  retro: typeof __FEATURE_RETRO__ !== "undefined" ? __FEATURE_RETRO__ : true,
  levels: typeof __FEATURE_LEVELS__ !== "undefined" ? __FEATURE_LEVELS__ : true,
  "hand-paths": typeof __FEATURE_HAND_PATHS__ !== "undefined" ? __FEATURE_HAND_PATHS__ : true,
  video: typeof __FEATURE_VIDEO__ !== "undefined" ? __FEATURE_VIDEO__ : true,
  stage: typeof __FEATURE_STAGE__ !== "undefined" ? __FEATURE_STAGE__ : true,
  mandala: typeof __FEATURE_MANDALA__ !== "undefined" ? __FEATURE_MANDALA__ : true,
  lab: typeof __FEATURE_LAB__ !== "undefined" ? __FEATURE_LAB__ : true,
  settings: typeof __FEATURE_SETTINGS__ !== "undefined" ? __FEATURE_SETTINGS__ : true,
};

export const ENABLED_MODULE_DEFINITIONS = MODULE_DEFINITIONS.filter(
  (m) => FEATURE_ENABLED[m.id] !== false
);
