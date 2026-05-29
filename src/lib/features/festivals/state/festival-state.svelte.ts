import type { Festival, FestivalAttendance } from "../domain/models/festival";
import type { UserFestivalTracker } from "../domain/models/festival-tracker";
import type { TeachingPortfolio } from "../domain/models/teaching-portfolio";
import type { FestivalFilters } from "../services/types";

interface FestivalLoaderModule {
  loadFestivals(filters: FestivalFilters, pageSize?: number, cursor?: unknown): Promise<{ festivals: Festival[]; nextCursor: unknown | null }>;
  getByIds(ids: string[]): Promise<Festival[]>;
}

interface FestivalTrackerModule {
  get(userId: string, festivalId: string): Promise<UserFestivalTracker | null>;
  getAllForUser(userId: string): Promise<Map<string, UserFestivalTracker>>;
  set(userId: string, festivalId: string, data: Partial<UserFestivalTracker>): Promise<void>;
  deleteTracker(userId: string, festivalId: string): Promise<void>;
}

interface FestivalAttendanceModule {
  getCount(festivalId: string): Promise<number>;
  getAttendees(festivalId: string): Promise<FestivalAttendance[]>;
  setAttendance(festivalId: string, userId: string, data: Omit<FestivalAttendance, "festivalId" | "userId">): Promise<void>;
  removeAttendance(festivalId: string, userId: string): Promise<void>;
}

interface WorkshopPortfolioModule {
  get(userId: string): Promise<TeachingPortfolio | null>;
  set(userId: string, portfolio: TeachingPortfolio): Promise<void>;
}

export type FestivalTab = "discover" | "map" | "calendar" | "portfolio";

export function createFestivalState(
  loader: FestivalLoaderModule,
  trackerRepo: FestivalTrackerModule,
  attendanceRepo: FestivalAttendanceModule,
  portfolioRepo: WorkshopPortfolioModule
) {
  let _festivals = $state<Festival[]>([]);
  let _trackers = $state<Map<string, UserFestivalTracker>>(new Map());
  let _portfolio = $state<TeachingPortfolio | null>(null);
  let _attendanceCounts = $state<Map<string, number>>(new Map());
  let _filters = $state<FestivalFilters>({});
  let _activeTab = $state<FestivalTab>("discover");
  let _isLoading = $state(false);
  let _selectedFestival = $state<Festival | null>(null);
  let _nextCursor = $state<unknown | null>(null);

  return {
    get festivals() { return _festivals; },
    get trackers() { return _trackers; },
    get portfolio() { return _portfolio; },
    get attendanceCounts() { return _attendanceCounts; },
    get filters() { return _filters; },
    get activeTab() { return _activeTab; },
    get isLoading() { return _isLoading; },
    get selectedFestival() { return _selectedFestival; },
    get hasMore() { return _nextCursor !== null; },

    get trackedFestivals() {
      return _festivals.filter(f => _trackers.has(f.id));
    },

    set activeTab(tab: FestivalTab) { _activeTab = tab; },
    set filters(f: FestivalFilters) { _filters = f; },
    set selectedFestival(f: Festival | null) { _selectedFestival = f; },

    async loadFestivals(userId: string) {
      _isLoading = true;
      try {
        const [result, allTrackers] = await Promise.all([
          loader.loadFestivals(_filters),
          trackerRepo.getAllForUser(userId),
        ]);
        _festivals = result.festivals;
        _nextCursor = result.nextCursor;
        _trackers = allTrackers;
      } catch (error) {
        console.error("Failed to load festivals", error);
      } finally {
        _isLoading = false;
      }
    },

    async loadMore() {
      if (!_nextCursor) return;
      const result = await loader.loadFestivals(_filters, 20, _nextCursor);
      _festivals = [..._festivals, ...result.festivals];
      _nextCursor = result.nextCursor;
    },

    async updateTracker(userId: string, festivalId: string, data: Partial<UserFestivalTracker>) {
      try {
        await trackerRepo.set(userId, festivalId, data);
        const updated = await trackerRepo.get(userId, festivalId);
        if (updated) {
          _trackers = new Map([..._trackers, [festivalId, updated]]);
        }
      } catch (error) {
        console.error("Failed to update tracker", error);
      }
    },

    async loadPortfolio(userId: string) {
      try {
        _portfolio = await portfolioRepo.get(userId);
      } catch (error) {
        console.error("Failed to load portfolio", error);
      }
    },

    async savePortfolio(userId: string, portfolio: TeachingPortfolio) {
      try {
        await portfolioRepo.set(userId, portfolio);
        _portfolio = portfolio;
      } catch (error) {
        console.error("Failed to save portfolio", error);
      }
    },

    async loadAttendanceCounts(festivalIds: string[]) {
      for (const id of festivalIds) {
        const count = await attendanceRepo.getCount(id);
        _attendanceCounts = new Map([..._attendanceCounts, [id, count]]);
      }
    },
  };
}

export type FestivalState = ReturnType<typeof createFestivalState>;
