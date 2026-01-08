/**
 * Module Definitions
 *
 * Defines all application modules with their metadata.
 * Separated from state management for cleaner architecture.
 */

import type { ModuleDefinition } from "../domain/types";
import {
  CREATE_TABS,
  LEARN_TABS,
  DISCOVER_TABS,
  ANIMATE_TABS,
  TRAIN_TABS,
  LIBRARY_TABS,
  FEEDBACK_TABS,
  ML_TRAINING_TABS,
  ADMIN_TABS,
  SETTINGS_TABS,
  REALM_TABS,
  SKEWLAB_TABS,
} from "./tab-definitions";

// Module definitions for the new navigation system
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: '<i class="fas fa-home" style="color: #10b981;" aria-hidden="true"></i>',
    color: "#10b981", // Emerald - home/dashboard
    description: "Your TKA Scribe home",
    isMain: true,
    sections: [], // Dashboard has no sub-tabs
  },
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
    id: "discover",
    label: "Discover",
    icon: '<i class="fas fa-compass" style="color: #a855f7;" aria-hidden="true"></i>',
    color: "#a855f7", // Purple - discovery/exploration
    description: "Discover sequences and creators",
    isMain: true,
    sections: DISCOVER_TABS,
  },
  // Community module retired - Creators moved to Discover, Challenges to Dashboard
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
    sections: ANIMATE_TABS, // TODO: Rename to COMPOSE_TABS
  },
  {
    id: "train",
    label: "Train",
    icon: '<i class="fas fa-running" style="color: #ef4444;" aria-hidden="true"></i>',
    color: "#ef4444", // Red - action/training
    description: "Practice with real-time scoring",
    isMain: true,
    sections: TRAIN_TABS,
  },
  {
    id: "library",
    label: "Library",
    icon: '<i class="fas fa-book" style="color: #0891b2;" aria-hidden="true"></i>',
    color: "#0891b2", // Cyan - personal collection
    description: "Your sequences, collections, and compositions",
    isMain: true,
    sections: LIBRARY_TABS,
  },
  // Removed: inbox module (Messages/notifications accessible via Dashboard widget drawer)
  // Removed: account module (merged into Dashboard - profile widget handles auth)
  // Removed: edit module (Edit functionality is now a slide-out panel accessible from Create and Sequence Viewer)
  // Removed: about module (content moved to Dashboard > Support widget)
  {
    id: "word_card",
    label: "Word Card",
    icon: '<i class="fas fa-id-card" style="color: #6366f1;" aria-hidden="true"></i>',
    color: "#6366f1", // Indigo - flashcards/learning
    description: "Browse words as flashcard sequences",
    isMain: true,
    sections: [], // Single-tab module
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
    id: "ml-training",
    label: "ML Training",
    icon: '<i class="fas fa-brain" style="color: #8b5cf6;" aria-hidden="true"></i>',
    color: "#8b5cf6", // Purple - AI/ML
    description: "Train prop detection models",
    isMain: true, // Visibility controlled by getModuleDefinitions() based on tester status
    sections: ML_TRAINING_TABS,
  },
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
    id: "skewlab",
    label: "Skew Lab",
    icon: '<i class="fas fa-flask" style="color: #f97316;" aria-hidden="true"></i>',
    color: "#f97316", // Orange - experimental
    description: "Experimental skewed positions development (temporary)",
    isMain: true, // Visibility controlled by getModuleDefinitions() based on admin status
    sections: SKEWLAB_TABS,
  },
  {
    id: "realm",
    label: "Realm",
    icon: '<i class="fas fa-vr-cardboard" style="color: #06b6d4;" aria-hidden="true"></i>',
    color: "#06b6d4", // Cyan - 3D/immersive
    description: "Unified 3D destination hub - Stage, Gallery, Infinite Worlds, and more",
    isMain: true, // Visibility controlled by feature flags (admin-only)
    sections: [], // Uses destination picker instead of tabs
  },
  {
    id: "mandala",
    label: "Mandala",
    icon: '<i class="fas fa-dharmachakra" style="color: #f472b6;" aria-hidden="true"></i>',
    color: "#f472b6", // Pink - artistic/creative
    description: "Create kaleidoscope art with TKA elements",
    isMain: true, // Visibility controlled by feature flags (admin-only for now)
    sections: [], // Single-tab creative studio
  },
  {
    id: "background-builder",
    label: "BG Builder",
    icon: '<i class="fas fa-water" style="color: #0ea5e9;" aria-hidden="true"></i>',
    color: "#0ea5e9", // Sky blue - ocean/background
    description: "Design and iterate on deep ocean background elements",
    isMain: true, // Admin-only for development
    sections: [], // Tab switching handled internally
  },
  {
    id: "settings",
    label: "Settings",
    icon: '<i class="fas fa-cog" style="color: #64748b;" aria-hidden="true"></i>',
    color: "#64748b", // Slate - neutral settings color
    description: "Configure app preferences",
    isMain: true, // Main module button on dashboard
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
