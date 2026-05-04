import type { SubDrawerType } from "./contracts/types";

const SUB_DRAWER_KEY = "tka_sequence_actions_sub_drawer";

/**
 * Persists sub-drawer state to sessionStorage.
 * - Survives HMR (hot module replacement)
 * - Clears when browser tab closes (session end)
 */

export function getActiveSubDrawer(): SubDrawerType {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(SUB_DRAWER_KEY);
  if (!value) return null;

  // Validate the stored value
  const validTypes: SubDrawerType[] = [
    "help",
    "turnPattern",
    "rotationDirection",
    "duration",
    "extend",
  ];
  return validTypes.includes(value as SubDrawerType)
    ? (value as SubDrawerType)
    : null;
}

export function setActiveSubDrawer(drawer: SubDrawerType): void {
  if (typeof sessionStorage === "undefined") return;

  if (drawer) {
    sessionStorage.setItem(SUB_DRAWER_KEY, drawer);
  } else {
    sessionStorage.removeItem(SUB_DRAWER_KEY);
  }
}

export function clearSubDrawer(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SUB_DRAWER_KEY);
}
