// Guests (unauthenticated users) get a limited view of the app.
// Create and Browse are open, but restricted to specific tabs.
// Everything else - Learn, Social, Settings - requires signing in.

import type { AccessTier } from "./access-tier";

const GUEST_MODULE_ACCESS: Record<string, string[]> = {
  create: ["assemble", "construct", "generate"],
  browse: ["gallery"],
};

export function isModuleAccessible(
  moduleId: string,
  tier: AccessTier
): boolean {
  if (tier !== "guest") return true;
  return moduleId in GUEST_MODULE_ACCESS;
}

export function isTabAccessible(
  moduleId: string,
  tabId: string,
  tier: AccessTier
): boolean {
  if (tier !== "guest") return true;
  const allowedTabs = GUEST_MODULE_ACCESS[moduleId];
  if (!allowedTabs) return false;
  return allowedTabs.includes(tabId);
}

export function getAccessibleTabs(
  moduleId: string,
  tier: AccessTier
): string[] | null {
  if (tier !== "guest") return null;
  return GUEST_MODULE_ACCESS[moduleId] ?? [];
}
