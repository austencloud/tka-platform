/**
 * User Role Types
 *
 * Defines the available user roles in the system.
 * Roles are hierarchical: admin > tester > premium > user
 */

/**
 * Available user roles in order of increasing privilege
 */
export type UserRole = "user" | "premium" | "tester" | "admin";

/**
 * Role hierarchy for permission checks
 * Higher index = more privileges
 */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  "user",
  "premium",
  "tester",
  "admin",
] as const;

/**
 * Check if a role has at least the privilege level of another role
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 */
export function hasRolePrivilege(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

/**
 * Check if a role is admin
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Check if a role is at least tester level
 */
export function isTesterOrAbove(role: UserRole): boolean {
  return hasRolePrivilege(role, "tester");
}

/**
 * Check if a role is at least premium level
 */
export function isPremiumOrAbove(role: UserRole): boolean {
  return hasRolePrivilege(role, "premium");
}

/**
 * Role display configuration
 */
export const ROLE_DISPLAY: Record<
  UserRole,
  { label: string; color: string; icon: string }
> = {
  user: {
    label: "User",
    color: "#6b7280", // gray
    icon: "fa-user",
  },
  premium: {
    label: "Premium",
    color: "#f59e0b", // amber
    icon: "fa-crown",
  },
  tester: {
    label: "Tester",
    color: "#8b5cf6", // purple
    icon: "fa-flask",
  },
  admin: {
    label: "Admin",
    color: "#ef4444", // red
    icon: "fa-shield-halved",
  },
};
