/**
 * Analytics Configuration
 *
 * Centralized display configuration for analytics dashboards.
 * Maps internal identifiers to human-readable labels and colors.
 */

export interface AnalyticsDisplayConfig {
  label: string;
  color: string;
}

/**
 * Event type display configuration
 * Maps activity event types to display labels and colors
 */
export const EVENT_TYPE_CONFIG: Record<string, AnalyticsDisplayConfig> = {
  session_start: { label: "Sessions", color: "#10b981" },
  module_view: { label: "Module Views", color: "#3b82f6" },
  sequence_create: { label: "Sequences Created", color: "#8b5cf6" },
  sequence_save: { label: "Sequences Saved", color: "#6366f1" },
  sequence_delete: { label: "Sequences Deleted", color: "#ef4444" },
  sequence_play: { label: "Animations Played", color: "#f59e0b" },
  sequence_export: { label: "Exports", color: "#ec4899" },
  setting_change: { label: "Settings Changed", color: "#64748b" },
};

/**
 * Module and tab display configuration
 * Maps module identifiers (and module:tab combinations) to display labels and colors
 */
export const MODULE_USAGE_CONFIG: Record<string, AnalyticsDisplayConfig> = {
  // Main modules
  create: { label: "Create", color: "#f59e0b" },
  browse: { label: "Browse", color: "#a855f7" },
  learn: { label: "Learn", color: "#3b82f6" },
  library: { label: "Library", color: "#10b981" },
  animate: { label: "Animate", color: "#ec4899" },
  community: { label: "Community", color: "#06b6d4" },
  admin: { label: "Admin", color: "#ffd700" },

  // Create tabs
  "create:construct": { label: "Create → Construct", color: "#3b82f6" },
  "create:assemble": { label: "Create → Assemble", color: "#8b5cf6" },
  "create:generate": { label: "Create → Generate", color: "#f59e0b" },

  // Learn tabs
  "learn:concepts": { label: "Learn → Concepts", color: "#60a5fa" },
  "learn:play": { label: "Learn → Play", color: "#f472b6" },

  // Browse tabs
  "browse:gallery": { label: "Browse → Gallery", color: "#a855f7" },
  "browse:collections": { label: "Browse → Library", color: "#f59e0b" },

  // Community tabs
  "community:leaderboards": {
    label: "Community → Leaderboards",
    color: "#fbbf24",
  },
  "community:creators": { label: "Community → Creators", color: "#06b6d4" },
  "community:support": { label: "Community → Support", color: "#ec4899" },

  // Animate tabs
  "animate:single": { label: "Animate → Single", color: "#3b82f6" },
  "animate:tunnel": { label: "Animate → Tunnel", color: "#ec4899" },
  "animate:mirror": { label: "Animate → Mirror", color: "#8b5cf6" },
  "animate:grid": { label: "Animate → Grid", color: "#f59e0b" },

  // Admin tabs
  "admin:analytics": { label: "Admin → Analytics", color: "#3b82f6" },
  "admin:challenges": { label: "Admin → Challenges", color: "#ffd700" },
  "admin:users": { label: "Admin → Users", color: "#10b981" },
  "admin:flags": { label: "Admin → Flags", color: "#8b5cf6" },
  "admin:tools": { label: "Admin → Tools", color: "#f97316" },
};

/**
 * Default color for unknown event types or modules
 */
export const DEFAULT_ANALYTICS_COLOR = "#94a3b8";

/**
 * Get display config for an event type, with fallback
 */
export function getEventTypeDisplay(eventType: string): AnalyticsDisplayConfig {
  return (
    EVENT_TYPE_CONFIG[eventType] ?? {
      label: formatEventTypeLabel(eventType),
      color: DEFAULT_ANALYTICS_COLOR,
    }
  );
}

/**
 * Get display config for a module (or module:tab), with fallback
 */
export function getModuleDisplay(module: string): AnalyticsDisplayConfig {
  return (
    MODULE_USAGE_CONFIG[module] ?? {
      label: formatModuleTabLabel(module),
      color: DEFAULT_ANALYTICS_COLOR,
    }
  );
}

/**
 * Format event type to human-readable label
 * e.g., "session_start" -> "Session Start"
 */
export function formatEventTypeLabel(eventType: string): string {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format module:tab string to human-readable label
 * e.g., "create:generate" -> "Create → Generate"
 */
export function formatModuleTabLabel(moduleTab: string): string {
  const parts = moduleTab.split(":");
  if (parts.length === 2) {
    const modulePart = parts[0];
    const tabPart = parts[1];
    return `${capitalizeFirst(modulePart ?? "")} → ${capitalizeFirst(tabPart ?? "")}`;
  }
  return capitalizeFirst(moduleTab);
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
