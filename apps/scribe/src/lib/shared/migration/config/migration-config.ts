/**
 * Domain Migration Configuration
 *
 * Configure the migration from tkaflowarts.com to tkascribe.com
 * Set ENABLED to true when ready to start notifying users.
 */

export const MIGRATION_CONFIG = {
  /** Set to true to start showing migration notices */
  ENABLED: false,

  /** Old domain that will be retired */
  OLD_DOMAIN: "tkaflowarts.com",

  /** New domain users should migrate to */
  NEW_DOMAIN: "tkascribe.com",

  /** Date when old domain stops working (set when you know) */
  MIGRATION_DEADLINE: new Date("2025-03-01"),

  /** Total number of reminders to show before deadline */
  TOTAL_REMINDERS: 5,

  /** Minimum hours between reminders (don't spam users) */
  MIN_HOURS_BETWEEN_REMINDERS: 24,

  /** Days before deadline to switch to "critical" severity */
  CRITICAL_THRESHOLD_DAYS: 7,

  /** Days before deadline to switch to "warning" severity */
  WARNING_THRESHOLD_DAYS: 30,

  /** localStorage key for tracking reminder state */
  STORAGE_KEY: "tka-migration-state",
} as const;

/**
 * Get severity based on days until deadline
 */
export function getMigrationSeverity(
  daysUntilDeadline: number
): "info" | "warning" | "critical" {
  if (daysUntilDeadline <= MIGRATION_CONFIG.CRITICAL_THRESHOLD_DAYS) {
    return "critical";
  }
  if (daysUntilDeadline <= MIGRATION_CONFIG.WARNING_THRESHOLD_DAYS) {
    return "warning";
  }
  return "info";
}

/**
 * Check if current hostname is the old domain
 */
export function isOnOldDomain(): boolean {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === MIGRATION_CONFIG.OLD_DOMAIN ||
    hostname === `www.${MIGRATION_CONFIG.OLD_DOMAIN}` ||
    // Also check for localhost/dev environments if you want to test
    (hostname === "localhost" && true) // Set to true to test locally
  );
}

/**
 * Get the full new URL with current path
 */
export function getNewDomainUrl(): string {
  if (typeof window === "undefined")
    return `https://${MIGRATION_CONFIG.NEW_DOMAIN}`;

  const { pathname, search, hash } = window.location;
  return `https://${MIGRATION_CONFIG.NEW_DOMAIN}${pathname}${search}${hash}`;
}

/**
 * Calculate days until migration deadline
 */
export function getDaysUntilDeadline(): number {
  const now = new Date();
  const deadline = MIGRATION_CONFIG.MIGRATION_DEADLINE;
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format deadline for display
 */
export function formatDeadline(): string {
  return MIGRATION_CONFIG.MIGRATION_DEADLINE.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
