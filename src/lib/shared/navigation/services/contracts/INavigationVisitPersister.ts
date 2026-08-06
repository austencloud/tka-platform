import type { NavigationVisit } from "../../domain/navigation-visit";

export interface INavigationVisitPersister {
  recordVisit(destinationId: string, visitedAt?: number): void;
  getVisits(): NavigationVisit[];
}
