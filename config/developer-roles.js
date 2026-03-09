/**
 * Developer Role Configuration
 *
 * Defines roles, permissions, and access control for the multi-developer
 * feedback system. Used by the CLI (scripts/fetch-feedback.js) to gate
 * actions based on who's logged in.
 *
 * Admin = Austen (project owner). Full access to everything.
 * Contributor = approved developers who can claim and work on feedback.
 */

/**
 * Available Roles
 */
export const ROLES = {
  admin: "admin",
  contributor: "contributor",
};

/**
 * Permission Actions
 *
 * Granular actions that can be granted to roles.
 */
export const ACTIONS = {
  VIEW_FEEDBACK: "view_feedback",
  CLAIM_ITEM: "claim_item",
  WORK_ON_CLAIM: "work_on_claim",
  MOVE_TO_IN_REVIEW: "move_to_in_review",
  MOVE_TO_COMPLETED: "move_to_completed",
  ARCHIVE: "archive",
  CHANGE_PRIORITY: "change_priority",
  DELETE_ANY: "delete_any",
  DELETE_OWN: "delete_own",
  EMERGENCY_UNCLAIM: "emergency_unclaim",
  CREATE_FEEDBACK: "create_feedback",
  MANAGE_DEVELOPERS: "manage_developers",
};

/**
 * Role-Permission Mapping
 *
 * Admin gets all actions. Contributors get a limited subset
 * focused on claiming, working, and submitting for review.
 */
export const ROLE_PERMISSIONS = {
  [ROLES.admin]: Object.values(ACTIONS),
  [ROLES.contributor]: [
    ACTIONS.VIEW_FEEDBACK,
    ACTIONS.CLAIM_ITEM,
    ACTIONS.WORK_ON_CLAIM,
    ACTIONS.MOVE_TO_IN_REVIEW,
    ACTIONS.DELETE_OWN,
    ACTIONS.CREATE_FEEDBACK,
  ],
};

/**
 * Transition-Action Mapping
 *
 * Maps "fromStatus->toStatus" strings to the permission action
 * required to perform that transition.
 */
export const TRANSITION_ACTIONS = {
  "new->in-progress": ACTIONS.CLAIM_ITEM,
  "in-progress->new": ACTIONS.WORK_ON_CLAIM,
  "in-progress->in-review": ACTIONS.MOVE_TO_IN_REVIEW,
  "in-review->in-progress": ACTIONS.MOVE_TO_COMPLETED, // admin sends back
  "in-review->completed": ACTIONS.MOVE_TO_COMPLETED,
  "completed->archived": ACTIONS.ARCHIVE,
  "completed->in-review": ACTIONS.MOVE_TO_COMPLETED,
  "archived->new": ACTIONS.ARCHIVE,
};

/**
 * Check if a role has a specific permission.
 *
 * @param {string} role - The role to check (from ROLES)
 * @param {string} action - The action to check (from ACTIONS)
 * @returns {boolean} Whether the role has the permission
 */
export function hasPermission(role, action) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(action);
}

/**
 * Check if a role can perform a specific status transition.
 *
 * @param {string} role - The role to check (from ROLES)
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} Whether the role can perform this transition
 */
export function canTransition(role, fromStatus, toStatus) {
  const key = `${fromStatus}->${toStatus}`;
  const requiredAction = TRANSITION_ACTIONS[key];
  if (!requiredAction) return false;
  return hasPermission(role, requiredAction);
}

export default {
  ROLES,
  ACTIONS,
  ROLE_PERMISSIONS,
  TRANSITION_ACTIONS,
  hasPermission,
  canTransition,
};
