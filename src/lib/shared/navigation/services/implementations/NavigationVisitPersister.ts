import { NAVIGATION_VISITS_KEY } from "../../config/storage-keys";
import type {
  NavigationVisit,
  NavigationVisitPayload,
} from "../../domain/navigation-visit";
import type { INavigationVisitPersister } from "../contracts/INavigationVisitPersister";

const SCHEMA_VERSION = 1;
const RAPID_REPEAT_WINDOW_MS = 30_000;
const MAX_DESTINATIONS_PER_PROFILE = 100;

type ScopeProvider = () => string;

export class NavigationVisitPersister implements INavigationVisitPersister {
  constructor(
    private readonly storage: Storage | null,
    private readonly getScope: ScopeProvider
  ) {}

  recordVisit(destinationId: string, visitedAt = Date.now()): void {
    if (!this.storage || !destinationId) return;

    const payload = this.readPayload();
    const scope = this.getScope();
    const visits = payload.profiles[scope] ?? [];
    const previous = visits.find(
      (visit) => visit.destinationId === destinationId
    );
    const shouldCount =
      !previous || visitedAt - previous.lastVisitedAt >= RAPID_REPEAT_WINDOW_MS;
    const nextVisit: NavigationVisit = {
      destinationId,
      visitCount: previous ? previous.visitCount + (shouldCount ? 1 : 0) : 1,
      lastVisitedAt: visitedAt,
    };

    payload.profiles[scope] = [
      nextVisit,
      ...visits.filter((visit) => visit.destinationId !== destinationId),
    ]
      .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
      .slice(0, MAX_DESTINATIONS_PER_PROFILE);

    this.writePayload(payload);
  }

  getVisits(): NavigationVisit[] {
    const scope = this.getScope();
    return this.readPayload().profiles[scope] ?? [];
  }

  private readPayload(): NavigationVisitPayload {
    if (!this.storage) return this.emptyPayload();

    try {
      const saved = this.storage.getItem(NAVIGATION_VISITS_KEY);
      if (!saved) return this.emptyPayload();

      const parsed: unknown = JSON.parse(saved);
      return this.validatePayload(parsed);
    } catch {
      // Recommendation history is optional. A broken local payload should
      // reset suggestions, never block the destination the user chose.
      return this.emptyPayload();
    }
  }

  private writePayload(payload: NavigationVisitPayload): void {
    try {
      this.storage?.setItem(NAVIGATION_VISITS_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be unavailable in private modes or full. Jump to still
      // works as a search surface without personalized suggestions.
    }
  }

  private validatePayload(value: unknown): NavigationVisitPayload {
    if (!value || typeof value !== "object") return this.emptyPayload();

    const candidate = value as Partial<NavigationVisitPayload>;
    if (
      candidate.version !== SCHEMA_VERSION ||
      !candidate.profiles ||
      typeof candidate.profiles !== "object" ||
      Array.isArray(candidate.profiles)
    ) {
      return this.emptyPayload();
    }

    const profiles: Record<string, NavigationVisit[]> = {};
    for (const [scope, rawVisits] of Object.entries(candidate.profiles)) {
      if (!Array.isArray(rawVisits)) continue;

      const visits = rawVisits
        .filter((visit): visit is NavigationVisit => this.isVisit(visit))
        .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
        .slice(0, MAX_DESTINATIONS_PER_PROFILE);
      profiles[scope] = visits;
    }

    return { version: SCHEMA_VERSION, profiles };
  }

  private isVisit(value: unknown): value is NavigationVisit {
    if (!value || typeof value !== "object") return false;
    const visit = value as Partial<NavigationVisit>;
    return (
      typeof visit.destinationId === "string" &&
      visit.destinationId.length > 0 &&
      typeof visit.visitCount === "number" &&
      Number.isInteger(visit.visitCount) &&
      visit.visitCount > 0 &&
      typeof visit.lastVisitedAt === "number" &&
      Number.isFinite(visit.lastVisitedAt) &&
      visit.lastVisitedAt >= 0
    );
  }

  private emptyPayload(): NavigationVisitPayload {
    return { version: SCHEMA_VERSION, profiles: {} };
  }
}
