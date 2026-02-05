/**
 * Role Display Utilities
 * Shared utilities for displaying user roles
 */

import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
import { ROLE_DISPLAY } from "$lib/shared/auth/domain/models/UserRole";

export function getRoleColor(role: UserRole): string {
  return ROLE_DISPLAY[role].color;
}

export function getRoleIcon(role: UserRole): string {
  return ROLE_DISPLAY[role].icon;
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_DISPLAY[role].label;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
