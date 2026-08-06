import type { ModuleId } from "./types";

export interface NavigationVisit {
  destinationId: string;
  visitCount: number;
  lastVisitedAt: number;
}

export interface NavigationVisitPayload {
  version: 1;
  profiles: Record<string, NavigationVisit[]>;
}

export function buildNavigationDestinationId(
  moduleId: ModuleId,
  tabId?: string
): string {
  return tabId ? `navigation:${moduleId}:${tabId}` : `navigation:${moduleId}`;
}
