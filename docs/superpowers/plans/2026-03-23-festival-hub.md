# Festival Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Festival Hub module for discovering flow festivals worldwide, tracking application status, and managing a teaching portfolio.

**Architecture:** New top-level module ("festivals") with 4 tabs (Discover, Map, Calendar, My Workshops). Data layer uses Firestore collections. State follows factory + context pattern. Map reuses existing Google Maps infrastructure with MarkerClusterer. Calendar adapts Ringmaster's MonthView pattern.

**Tech Stack:** Svelte 5 + TypeScript + ITI DI + Firebase Firestore + Google Maps API + @googlemaps/markerclusterer + date-fns

**Spec:** `docs/superpowers/specs/2026-03-23-festival-hub-design.md`

---

## File Structure

### Domain Models
- `src/lib/features/festivals/domain/models/festival.ts` — Festival, FestivalAttendance, FestivalSubmission interfaces
- `src/lib/features/festivals/domain/models/festival-tracker.ts` — UserFestivalTracker interface
- `src/lib/features/festivals/domain/models/teaching-portfolio.ts` — TeachingPortfolio, WorkshopTemplate, BioVersion interfaces

### Service Contracts
- `src/lib/features/festivals/services/contracts/IFestivalLoader.ts`
- `src/lib/features/festivals/services/contracts/IFestivalRepository.ts`
- `src/lib/features/festivals/services/contracts/IFestivalTrackerRepository.ts`
- `src/lib/features/festivals/services/contracts/IFestivalAttendanceRepository.ts`
- `src/lib/features/festivals/services/contracts/IWorkshopPortfolioRepository.ts`
- `src/lib/features/festivals/services/contracts/IFestivalSubmissionReviewer.ts`

### Service Implementations
- `src/lib/features/festivals/services/implementations/FestivalLoader.ts`
- `src/lib/features/festivals/services/implementations/FestivalRepository.ts`
- `src/lib/features/festivals/services/implementations/FestivalTrackerRepository.ts`
- `src/lib/features/festivals/services/implementations/FestivalAttendanceRepository.ts`
- `src/lib/features/festivals/services/implementations/WorkshopPortfolioRepository.ts`
- `src/lib/features/festivals/services/implementations/FestivalSubmissionReviewer.ts`

### State & Context
- `src/lib/features/festivals/state/festival-state.svelte.ts` — createFestivalState factory
- `src/lib/features/festivals/context/festival-context.ts` — set/get context

### DI Container
- `src/lib/shared/di/containers/festival-container.ts`

### Components
- `src/lib/features/festivals/FestivalModule.svelte` — Module root with tab navigation
- `src/lib/features/festivals/components/discover/DiscoverTab.svelte`
- `src/lib/features/festivals/components/discover/FestivalCard.svelte`
- `src/lib/features/festivals/components/discover/FestivalFilterBar.svelte`
- `src/lib/features/festivals/components/discover/FestivalDetailView.svelte`
- `src/lib/features/festivals/components/discover/FestivalMaterialsPanel.svelte`
- `src/lib/features/festivals/components/discover/TrackerControls.svelte`
- `src/lib/features/festivals/components/discover/AttendanceBadge.svelte`
- `src/lib/features/festivals/components/map/FestivalMap.svelte`
- `src/lib/features/festivals/components/map/FestivalMapPopup.svelte`
- `src/lib/features/festivals/components/calendar/FestivalCalendar.svelte`
- `src/lib/features/festivals/components/calendar/FestivalMonthView.svelte`
- `src/lib/features/festivals/components/calendar/FestivalDayCell.svelte`
- `src/lib/features/festivals/components/calendar/FestivalCalendarEntry.svelte`
- `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`
- `src/lib/features/festivals/components/portfolio/WorkshopTemplateCard.svelte`
- `src/lib/features/festivals/components/portfolio/BioEditor.svelte`
- `src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte`
- `src/lib/features/festivals/components/moderation/ModerationQueue.svelte`

### Navigation & Wiring
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` — Add FESTIVAL_TABS
- Modify: `src/lib/shared/navigation/config/module-definitions.ts` — Add festivals module
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte` — Add festivals loader
- Modify: `src/lib/shared/di/container-types.ts` — Add FestivalContainer type
- Modify: `src/lib/shared/di/index.ts` — Wire festival container

### Seed Data
- `src/lib/features/festivals/data/festival-seed.ts` — Initial festival directory entries
- `src/lib/features/festivals/data/portfolio-seed.ts` — Austen's teaching portfolio

---

## Task 1: Domain Models

**Files:**
- Create: `src/lib/features/festivals/domain/models/festival.ts`
- Create: `src/lib/features/festivals/domain/models/festival-tracker.ts`
- Create: `src/lib/features/festivals/domain/models/teaching-portfolio.ts`

- [ ] **Step 1: Create festival model**

```typescript
// src/lib/features/festivals/domain/models/festival.ts
import type { Timestamp } from "firebase/firestore";

export type FestivalRegion =
  | "north-america"
  | "europe"
  | "oceania"
  | "asia"
  | "south-america"
  | "africa";

export type FestivalSize = "intimate" | "medium" | "large";
export type FestivalSource = "scraped" | "user-submitted" | "curated";
export type ModerationStatus = "pending" | "approved";
export type FestivalStatus = "upcoming" | "past";

export interface FestivalLocation {
  venue?: string;
  city: string;
  state?: string;
  country: string;
  coordinates: { lat: number; lng: number };
}

export interface Festival {
  id: string;
  name: string;
  organizationId: string;
  organization: string;
  location: FestivalLocation;
  dates: {
    start: Timestamp;
    end: Timestamp;
  };
  applicationDeadline?: Timestamp;
  applicationUrl?: string;
  applicationContact?: string;
  seekingInstructors: boolean;
  seekingPerformers: boolean;
  description: string;
  websiteUrl?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
  };
  estimatedSize?: FestivalSize;
  region: FestivalRegion;
  status: FestivalStatus;
  tags: string[];
  source: FestivalSource;
  moderationStatus: ModerationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AttendanceStatus = "interested" | "going";
export type AttendanceRole = "attendee" | "instructor" | "performer";

export interface FestivalAttendance {
  festivalId: string;
  userId: string;
  status: AttendanceStatus;
  role?: AttendanceRole;
  createdAt: Timestamp;
}

export interface FestivalSubmission {
  id: string;
  name: string;
  city: string;
  country: string;
  venue?: string;
  dates: { start: Timestamp; end: Timestamp };
  websiteUrl: string;
  applicationUrl?: string;
  description?: string;
  seekingInstructors: boolean;
  seekingPerformers: boolean;
  tags: string[];
  submittedBy: string;             // userId
  moderationStatus: ModerationStatus;
  submittedAt: Timestamp;
}
```

- [ ] **Step 2: Create tracker model**

```typescript
// src/lib/features/festivals/domain/models/festival-tracker.ts
import type { Timestamp } from "firebase/firestore";

export type TrackerStatus =
  | "interested"
  | "applying"
  | "applied"
  | "accepted"
  | "declined"
  | "attending";

export interface UserFestivalTracker {
  userId: string;
  festivalId: string;
  status: TrackerStatus;
  appliedAs: ("instructor" | "performer")[];
  workshopsSubmitted: string[];
  stipendRequested?: number;
  notes: string;
  applicationDate?: Timestamp;
  responseDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 3: Create teaching portfolio model**

```typescript
// src/lib/features/festivals/domain/models/teaching-portfolio.ts
import type { Timestamp } from "firebase/firestore";

export type WorkshopLevel =
  | "introductory"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "mixed";

export interface WorkshopTemplate {
  id: string;
  title: string;
  level: WorkshopLevel;
  props: string[];
  description: string;
  themes: string[];
  solo: boolean;
}

export interface BioVersion {
  id: string;
  label: string;
  text: string;
}

export interface TeachingPortfolio {
  userId: string;
  classes: WorkshopTemplate[];
  bios: BioVersion[];
  performanceCredits: string[];
  performanceVideos: string[];
  socialLinks: {
    website?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
  insuranceInfo?: {
    provider: string;
    policyExpiration?: Timestamp;
  };
  homeCity: string;
  homeCountry: string;
  yearsTeaching: number;
  yearsPerforming: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 4: Verify types compile**

Run: `npm run check`
Expected: No errors related to festival models

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/festivals/domain/
git commit -m "feat(festivals): add domain models for festival hub"
```

---

## Task 2: Service Contracts & Implementations

**Files:**
- Create: All 6 contract interfaces
- Create: All 6 implementation classes

- [ ] **Step 1: Create IFestivalRepository contract**

```typescript
// src/lib/features/festivals/services/contracts/IFestivalRepository.ts
import type { Festival } from "../../domain/models/festival";

export interface IFestivalRepository {
  getById(id: string): Promise<Festival | null>;
  create(festival: Omit<Festival, "id">): Promise<string>;
  update(id: string, data: Partial<Festival>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Create IFestivalLoader contract**

```typescript
// src/lib/features/festivals/services/contracts/IFestivalLoader.ts
import type { Festival, FestivalRegion } from "../../domain/models/festival";
import type { TrackerStatus } from "../../domain/models/festival-tracker";

export interface FestivalFilters {
  region?: FestivalRegion;
  timeWindow?: "upcoming" | "3months" | "6months" | "year";
  seeking?: "instructors" | "performers" | "applications-open";
  trackerStatus?: TrackerStatus;
}

export interface IFestivalLoader {
  loadFestivals(filters: FestivalFilters, pageSize?: number, cursor?: unknown): Promise<{
    festivals: Festival[];
    nextCursor: unknown | null;
  }>;
  getByIds(ids: string[]): Promise<Festival[]>;
}
```

- [ ] **Step 3: Create IFestivalTrackerRepository contract**

```typescript
// src/lib/features/festivals/services/contracts/IFestivalTrackerRepository.ts
import type { UserFestivalTracker } from "../../domain/models/festival-tracker";

export interface IFestivalTrackerRepository {
  get(userId: string, festivalId: string): Promise<UserFestivalTracker | null>;
  getAllForUser(userId: string): Promise<Map<string, UserFestivalTracker>>;
  set(userId: string, festivalId: string, data: Partial<UserFestivalTracker>): Promise<void>;
  delete(userId: string, festivalId: string): Promise<void>;
}
```

- [ ] **Step 3b: Create IFestivalAttendanceRepository contract**

```typescript
// src/lib/features/festivals/services/contracts/IFestivalAttendanceRepository.ts
import type { FestivalAttendance } from "../../domain/models/festival";

export interface IFestivalAttendanceRepository {
  getCount(festivalId: string): Promise<number>;
  getAttendees(festivalId: string): Promise<FestivalAttendance[]>;
  setAttendance(festivalId: string, userId: string, data: Omit<FestivalAttendance, "festivalId" | "userId">): Promise<void>;
  removeAttendance(festivalId: string, userId: string): Promise<void>;
}
```

- [ ] **Step 3c: Create IWorkshopPortfolioRepository contract**

```typescript
// src/lib/features/festivals/services/contracts/IWorkshopPortfolioRepository.ts
import type { TeachingPortfolio } from "../../domain/models/teaching-portfolio";

export interface IWorkshopPortfolioRepository {
  get(userId: string): Promise<TeachingPortfolio | null>;
  set(userId: string, portfolio: TeachingPortfolio): Promise<void>;
}
```

- [ ] **Step 3d: Create IFestivalSubmissionReviewer contract**

```typescript
// src/lib/features/festivals/services/contracts/IFestivalSubmissionReviewer.ts
import type { FestivalSubmission } from "../../domain/models/festival";

export interface IFestivalSubmissionReviewer {
  getPending(): Promise<FestivalSubmission[]>;
  approve(submissionId: string): Promise<string>;  // Returns new festival ID
  reject(submissionId: string): Promise<void>;
  submit(submission: Omit<FestivalSubmission, "id" | "submittedAt" | "moderationStatus">): Promise<string>;
}
```

- [ ] **Step 4: Create FestivalRepository implementation**

```typescript
// src/lib/features/festivals/services/implementations/FestivalRepository.ts
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "$lib/shared/firebase/firebase";
import type { IFestivalRepository } from "../contracts/IFestivalRepository";
import type { Festival } from "../../domain/models/festival";

export class FestivalRepository implements IFestivalRepository {
  private readonly collectionRef = collection(db, "festivals");

  async getById(id: string): Promise<Festival | null> {
    const snap = await getDoc(doc(this.collectionRef, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Festival;
  }

  async create(festival: Omit<Festival, "id">): Promise<string> {
    const ref = doc(this.collectionRef);
    await setDoc(ref, { ...festival, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return ref.id;
  }

  async update(id: string, data: Partial<Festival>): Promise<void> {
    await updateDoc(doc(this.collectionRef, id), { ...data, updatedAt: serverTimestamp() });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id));
  }
}
```

- [ ] **Step 5: Create FestivalLoader implementation**

Implements filtered, paginated queries against the `festivals` collection. Uses Firestore `where`, `orderBy`, `limit`, `startAfter` for cursor pagination. Filters by region, date window, seeking flags. Loads tracked festivals by joining user tracker docs with festival docs.

- [ ] **Step 6: Create FestivalTrackerRepository implementation**

CRUD against `userFestivalTracking/{uid}/tracked/{festivalId}`. Each method takes userId as first param.

- [ ] **Step 7: Create FestivalAttendanceRepository implementation**

CRUD against `festivals/{festivalId}/attendance/{uid}`. Includes `getAttendanceCount(festivalId)` and `getAttendees(festivalId)`.

- [ ] **Step 8: Create WorkshopPortfolioRepository implementation**

Single-document CRUD at `userProfiles/{uid}/workshopPortfolio`. Get, set, and update.

- [ ] **Step 9: Create FestivalSubmissionReviewer implementation**

CRUD against `festivalSubmissions` collection. Includes `getPending()`, `approve(id)`, `reject(id)` methods. Approve moves data to `festivals` collection via FestivalRepository.

- [ ] **Step 10: Verify types compile**

Run: `npm run check`
Expected: No errors in festival services

- [ ] **Step 11: Commit**

```bash
git add src/lib/features/festivals/services/
git commit -m "feat(festivals): add service contracts and Firestore implementations"
```

---

## Task 3: DI Container & Wiring

**Files:**
- Create: `src/lib/shared/di/containers/festival-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create festival container**

```typescript
// src/lib/shared/di/containers/festival-container.ts
import { createContainer } from "iti";
import { FestivalRepository } from "$lib/features/festivals/services/implementations/FestivalRepository";
import { FestivalLoader } from "$lib/features/festivals/services/implementations/FestivalLoader";
import { FestivalTrackerRepository } from "$lib/features/festivals/services/implementations/FestivalTrackerRepository";
import { FestivalAttendanceRepository } from "$lib/features/festivals/services/implementations/FestivalAttendanceRepository";
import { WorkshopPortfolioRepository } from "$lib/features/festivals/services/implementations/WorkshopPortfolioRepository";
import { FestivalSubmissionReviewer } from "$lib/features/festivals/services/implementations/FestivalSubmissionReviewer";

export const festivalContainer = createContainer()
  .add({
    festivalRepository: () => new FestivalRepository(),
    festivalTrackerRepository: () => new FestivalTrackerRepository(),
    festivalAttendanceRepository: () => new FestivalAttendanceRepository(),
    workshopPortfolioRepository: () => new WorkshopPortfolioRepository(),
  })
  .add((deps) => ({
    festivalLoader: () => new FestivalLoader(deps.festivalRepository),
    festivalSubmissionReviewer: () => new FestivalSubmissionReviewer(deps.festivalRepository),
  }));

export type FestivalContainer = typeof festivalContainer;
```

- [ ] **Step 2: Add to container-types.ts**

Add import and type extraction following the existing pattern:
```typescript
import type { FestivalContainer } from "./containers/festival-container";
// In simple containers section:
type FestivalItems = ItemsOf<FestivalContainer>;
// Add to IAppContainerItems intersection
```

- [ ] **Step 3: Wire into buildAppContainer in index.ts**

Import `festivalContainer` and spread its items in the container builder, following the pattern of other containers (e.g., `communityContainer`).

- [ ] **Step 4: Verify types compile**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/festival-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(festivals): add DI container and wire into composition root"
```

---

## Task 4: State Factory & Context

**Files:**
- Create: `src/lib/features/festivals/state/festival-state.svelte.ts`
- Create: `src/lib/features/festivals/context/festival-context.ts`

- [ ] **Step 1: Create state factory**

```typescript
// src/lib/features/festivals/state/festival-state.svelte.ts
import type { Festival } from "../domain/models/festival";
import type { UserFestivalTracker } from "../domain/models/festival-tracker";
import type { TeachingPortfolio } from "../domain/models/teaching-portfolio";
import type { IFestivalLoader, FestivalFilters } from "../services/contracts/IFestivalLoader";
import type { IFestivalTrackerRepository } from "../services/contracts/IFestivalTrackerRepository";
import type { IFestivalAttendanceRepository } from "../services/contracts/IFestivalAttendanceRepository";
import type { IWorkshopPortfolioRepository } from "../services/contracts/IWorkshopPortfolioRepository";

export type FestivalTab = "discover" | "map" | "calendar" | "workshops";

export function createFestivalState(
  loader: IFestivalLoader,
  trackerRepo: IFestivalTrackerRepository,
  attendanceRepo: IFestivalAttendanceRepository,
  portfolioRepo: IWorkshopPortfolioRepository
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
        // Surface error to user via IErrorHandler (imported from container)
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

    // Derived: festivals the user is tracking (for calendar tab)
    get trackedFestivals() {
      return _festivals.filter(f => _trackers.has(f.id));
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
```

- [ ] **Step 2: Create context**

```typescript
// src/lib/features/festivals/context/festival-context.ts
import { getContext, setContext } from "svelte";
import type { FestivalState } from "../state/festival-state.svelte";

const FESTIVAL_CONTEXT_KEY = Symbol("festival-context");

export interface FestivalContext {
  state: FestivalState;
}

export function setFestivalContext(ctx: FestivalContext): void {
  setContext(FESTIVAL_CONTEXT_KEY, ctx);
}

export function getFestivalContext(): FestivalContext {
  return getContext<FestivalContext>(FESTIVAL_CONTEXT_KEY);
}
```

- [ ] **Step 3: Verify types compile**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/festivals/state/ src/lib/features/festivals/context/
git commit -m "feat(festivals): add state factory and context"
```

---

## Task 5: Module Shell & Navigation Wiring

**Files:**
- Create: `src/lib/features/festivals/FestivalModule.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/shared/navigation/config/module-definitions.ts`
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`

- [ ] **Step 1: Add FESTIVAL_TABS to tab-definitions.ts**

Add before the LAB_TABS export:

```typescript
export const FESTIVAL_TABS: Section[] = [
  {
    id: "discover",
    label: "Discover",
    icon: '<i class="fas fa-compass" aria-hidden="true"></i>',
    description: "Browse flow festivals worldwide",
  },
  {
    id: "map",
    label: "Map",
    icon: '<i class="fas fa-globe" aria-hidden="true"></i>',
    description: "Festival locations worldwide",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: '<i class="fas fa-calendar-alt" aria-hidden="true"></i>',
    description: "Tracked festival dates and deadlines",
  },
  {
    id: "workshops",
    label: "My Workshops",
    icon: '<i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>',
    description: "Teaching portfolio and application materials",
  },
];
```

- [ ] **Step 2: Add festivals module to module-definitions.ts**

Import `FESTIVAL_TABS` and add the module definition:

```typescript
{
  id: "festivals",
  label: "Festivals",
  icon: '<i class="fas fa-fire" style="color: #f97316;" aria-hidden="true"></i>',
  color: "#f97316",
  description: "Discover and apply to flow festivals",
  isMain: true,
  sections: FESTIVAL_TABS,
},
```

- [ ] **Step 3: Add festivals loader to ModuleRenderer.svelte**

```typescript
festivals: () => import("../../features/festivals/FestivalModule.svelte"),
```

- [ ] **Step 4: Create FestivalModule.svelte shell**

```svelte
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { createFestivalState, type FestivalTab } from "./state/festival-state.svelte";
  import { setFestivalContext } from "./context/festival-context";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { auth } from "$lib/shared/firebase/firebase";

  const state = createFestivalState(
    container.items.festivalLoader,
    container.items.festivalTrackerRepository,
    container.items.festivalAttendanceRepository,
    container.items.workshopPortfolioRepository
  );

  setFestivalContext({ state });

  const tabs: { id: FestivalTab; label: string; icon: string }[] = [
    { id: "discover", label: "Discover", icon: "fas fa-compass" },
    { id: "map", label: "Map", icon: "fas fa-globe" },
    { id: "calendar", label: "Calendar", icon: "fas fa-calendar-alt" },
    { id: "workshops", label: "My Workshops", icon: "fas fa-chalkboard-teacher" },
  ];

  $effect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      state.loadFestivals(uid);
      state.loadPortfolio(uid);
    }
  });
</script>

<div class="festival-module">
  <div class="tab-nav" role="tablist" aria-label="Festival Hub tabs">
    {#each tabs as tab}
      <button
        class="tab-button"
        class:active={state.activeTab === tab.id}
        onclick={() => (state.activeTab = tab.id)}
        role="tab"
        aria-selected={state.activeTab === tab.id}
      >
        <i class={tab.icon} aria-hidden="true"></i>
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="tab-content" role="tabpanel">
    {#if state.activeTab === "discover"}
      <p>Discover tab placeholder</p>
    {:else if state.activeTab === "map"}
      <p>Map tab placeholder</p>
    {:else if state.activeTab === "calendar"}
      <p>Calendar tab placeholder</p>
    {:else if state.activeTab === "workshops"}
      <p>Workshops tab placeholder</p>
    {/if}
  </div>
</div>

<style>
  .festival-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .tab-nav {
    display: flex;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 0 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .tab-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 12px;
    background: none;
    border: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    position: relative;
    transition: color 0.2s ease;
  }

  .tab-button:hover {
    color: var(--theme-text, #ffffff);
  }

  .tab-button.active {
    color: var(--theme-accent, #6366f1);
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 2px;
    background: var(--theme-accent, #6366f1);
    border-radius: 2px 2px 0 0;
  }

  .tab-button i {
    font-size: 16px;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    .tab-button span {
      display: none;
    }

    .tab-button {
      padding: 16px;
    }

    .tab-button i {
      font-size: 20px;
    }
  }
</style>
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: Builds successfully, festivals module accessible via navigation

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/festivals/FestivalModule.svelte src/lib/shared/navigation/config/tab-definitions.ts src/lib/shared/navigation/config/module-definitions.ts src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(festivals): add module shell with tab navigation and wiring"
```

---

## Task 6: Seed Data

**Files:**
- Create: `src/lib/features/festivals/data/festival-seed.ts`
- Create: `src/lib/features/festivals/data/portfolio-seed.ts`

- [ ] **Step 1: Create festival seed data**

Populate from scraped data at `docs/reference/festival-seed-data.json` (if available) plus known festivals from Gmail history: FireDrums, Kinetic Fire, FLAME Festival, Midwest Flow Fest, FMJ Winter Workshop, GLFF, Passout. Include organization, location, typical dates, website, application contacts, tags, region, estimated size.

- [ ] **Step 2: Create portfolio seed data**

```typescript
// src/lib/features/festivals/data/portfolio-seed.ts
import type { TeachingPortfolio } from "../domain/models/teaching-portfolio";

export const AUSTEN_PORTFOLIO_SEED: Omit<TeachingPortfolio, "userId" | "createdAt" | "updatedAt"> = {
  classes: [
    {
      id: "tka-1-learning-letters",
      title: "TKA 1: Learning Letters",
      level: "beginner",
      props: ["double-staves", "clubs"],
      description: "Foundations of antispins and isolations using negative space and body turns. Strict focus on thumb and prop orientation without finger-spinning. Letters A-B-C comprising split-same 1:1 motions. First three TKA words tunneled into 6 partner patterns.",
      themes: ["doubles", "clubs"],
      solo: true,
    },
    {
      id: "tka-2-writing-words",
      title: "TKA 2: Writing Words",
      level: "intermediate",
      props: ["mixed-static-props"],
      description: "Dive into The Kinetic Alphabet pictographs to create and communicate sequences. Students receive laminated sheets of pictograph sequences to practice and share. Construct 19 unique starter sequences using letters A-V.",
      themes: ["mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "tka-3-speaking-sentences",
      title: "TKA 3: Speaking Sentences",
      level: "advanced",
      props: ["double-staves", "mixed-static-props"],
      description: "Builds on previous classes with complex variations using turns at different points. Integrates dash and static motions with 3 new sequences. Construct circular words using higher-level sequence cards for intermediate and advanced practitioners.",
      themes: ["doubles", "mixed-prop-concepts", "static-prop-choreography"],
      solo: true,
    },
    {
      id: "intro-contact-juggling",
      title: "Intro to Contact Juggling: The Walking Halfpipe",
      level: "beginner",
      props: ["contact-ball"],
      description: "Three steps to unlocking a balance point using the cradle. Palm transfers and simple forearm rolls. Expand the folding line on both sides: lotus, waterfall, butterfly.",
      themes: ["contact-juggling"],
      solo: true,
    },
    {
      id: "balloon-animal-funtime",
      title: "Balloon Animal Funtime Hour",
      level: "beginner",
      props: ["balloons"],
      description: "Balloon sculpting fundamentals: dog, cat, flower, hat, sword, giraffe, rhino, bear, monkey, tiger. Materials and pumps provided. MOOP cleanup encouraged.",
      themes: ["balloon-art"],
      solo: true,
    },
    {
      id: "intro-club-passing",
      title: "Intro to Club Passing",
      level: "beginner",
      props: ["clubs"],
      description: "Target practice drills progressing to 4-count, 3-count, 2-count, doubles, doctors, tomahawks, and intermediate trick throws.",
      themes: ["clubs", "partner-prop-concepts"],
      solo: false,
    },
    {
      id: "letting-go-of-your-poi",
      title: "Letting Go Of Your Poi",
      level: "mixed",
      props: ["poi"],
      description: "Toss and catch points: grabbing poi head, under-leg/behind-back tosses, sideways, no beats. Combine tosses into two-poi sequences through different spinning modes.",
      themes: ["poi"],
      solo: true,
    },
  ],
  bios: [
    {
      id: "teaching-bio",
      label: "Teaching Bio",
      text: "Austen Cloud is a Chicago-based flow artist, juggler, and performer. He began his flow arts journey in 2014 and has been teaching classes at flow arts festivals and in his local Chicago community since 2017. His greatest passion is The Kinetic Alphabet, a notation and choreography transcription system designed to facilitate group choreography and large-scale synchronized performances that celebrate the complexity and beauty of flow arts.",
    },
    {
      id: "performing-bio",
      label: "Performing Bio",
      text: "Austen has been an avid lover of all flow arts since 2014 and is deeply passionate about teaching and performing. His biggest passion is The Kinetic Alphabet, a notation system designed to make choreography more accessible and communicable. He hopes to foster a culture of group collaboration so that flow arts techniques can expand and reach a higher level of appreciation and widespread involvement.",
    },
  ],
  performanceCredits: [
    "Black Circle",
    "Pyrotechniq",
    "Red Mink",
    "Stage Factor",
    "Cirque Aflame (own troupe since 2020)",
  ],
  performanceVideos: [
    "https://youtu.be/aTV3rtOIshU",
    "https://youtu.be/5k-aGn0nxLY",
    "https://youtu.be/c1AzCYasT-g?si=johN0ahBg41Xpa1E&t=378",
  ],
  socialLinks: {
    website: "thekineticalphabet.com",
    instagram: "@thekineticalphabet",
    facebook: "facebook.com/TheKineticAlphabet",
  },
  insuranceInfo: {
    provider: "Specialty Insurance Agency",
  },
  homeCity: "Chicago",
  homeCountry: "USA",
  yearsTeaching: 9,
  yearsPerforming: 12,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/festivals/data/
git commit -m "feat(festivals): add seed data for festivals and teaching portfolio"
```

---

## Task 7: Discover Tab — Festival Cards & Filter Bar

**Files:**
- Create: `src/lib/features/festivals/components/discover/DiscoverTab.svelte`
- Create: `src/lib/features/festivals/components/discover/FestivalCard.svelte`
- Create: `src/lib/features/festivals/components/discover/FestivalFilterBar.svelte`
- Create: `src/lib/features/festivals/components/discover/AttendanceBadge.svelte`
- Modify: `src/lib/features/festivals/FestivalModule.svelte` — Replace discover placeholder

- [ ] **Step 1: Create FestivalFilterBar**

Horizontal row of filter chips/dropdowns: Region, Time Window, Seeking, My Status. Each filter updates `state.filters` which triggers a reload.

- [ ] **Step 2: Create AttendanceBadge**

Small component showing "N going" count. Takes `festivalId`, reads from `state.attendanceCounts`.

- [ ] **Step 3: Create FestivalCard**

Card component displaying: name, location, dates, "Applications Open" badge (derived from `applicationDeadline` and `seekingInstructors`/`seekingPerformers`), deadline countdown (derived using `date-fns` `differenceInDays`), attendance badge, personal tracker status chip. Tap handler sets `state.selectedFestival`. Bookmark icon for one-tap "Interested" status.

- [ ] **Step 4: Create DiscoverTab**

Scrollable container rendering FestivalFilterBar at top, then a list of FestivalCard components. Infinite scroll triggers `state.loadMore()` when near bottom. Empty state when no festivals match filters. Loading spinner during fetch.

- [ ] **Step 5: Wire DiscoverTab into FestivalModule**

Replace the discover placeholder with the lazy import of DiscoverTab.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: Builds successfully

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/festivals/components/discover/ src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): add discover tab with festival cards and filters"
```

---

## Task 8: Festival Detail View & Tracker Controls

**Files:**
- Create: `src/lib/features/festivals/components/discover/FestivalDetailView.svelte`
- Create: `src/lib/features/festivals/components/discover/TrackerControls.svelte`
- Create: `src/lib/features/festivals/components/discover/FestivalMaterialsPanel.svelte`

- [ ] **Step 1: Create TrackerControls**

Status progression buttons: Interested → Applying → Applied → Accepted/Declined → Attending. Each button updates tracker via `state.updateTracker()`. Notes textarea, stipend input, applied-as checkboxes (instructor/performer), workshop selector (checkboxes from portfolio classes).

- [ ] **Step 2: Create FestivalMaterialsPanel**

Read-only panel showing user's workshop templates and bios from `state.portfolio`. Each item has a "Copy" button using `navigator.clipboard.writeText()`. Collapsible sections for classes, bios, links.

- [ ] **Step 3: Create FestivalDetailView**

Full-screen slide-in or drawer showing: festival header (name, org, dates, location), description, application link (prominent button), application contact email, website link, social links, attendance list, TrackerControls, and FestivalMaterialsPanel. Back button to return to feed.

- [ ] **Step 4: Wire detail view into FestivalModule**

When `state.selectedFestival` is non-null, show FestivalDetailView overlaying the tab content.

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/festivals/components/discover/ src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): add festival detail view with tracker and materials panel"
```

---

## Task 9: Festival Map Tab

**Files:**
- Create: `src/lib/features/festivals/components/map/FestivalMap.svelte`
- Create: `src/lib/features/festivals/components/map/FestivalMapPopup.svelte`
- Modify: `src/lib/features/festivals/FestivalModule.svelte` — Replace map placeholder

- [ ] **Step 1: Create FestivalMapPopup**

Popup card for selected festival pin. Shows: name, location, dates, "Applications Open" badge, attendance count. "View Details" button sets `state.selectedFestival`. Styled similar to `UserProfileMarker.svelte`.

- [ ] **Step 2: Create FestivalMap**

Adapt the `GlobalUserMap.svelte` pattern:
- Same Google Maps initialization (script loading, AdvancedMarkerElement)
- Different pin styling: orange pins for festivals (vs blue for users)
- **Wire up MarkerClusterer**: Import `MarkerClusterer` from `@googlemaps/markerclusterer`, pass map and markers array. This is the key integration that the community map has as a TODO.
- Festival pins created from `state.festivals` with coordinates
- Click handler on each pin sets a `selectedFestival` local state and shows FestivalMapPopup
- Default view: world zoom (zoom: 2, center: { lat: 20, lng: 0 })

```typescript
import { MarkerClusterer } from "@googlemaps/markerclusterer";

// After creating all markers:
const clusterer = new MarkerClusterer({ map, markers });
```

- [ ] **Step 3: Wire FestivalMap into FestivalModule**

Replace map placeholder. Pass festivals from state.

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/festivals/components/map/ src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): add map tab with MarkerClusterer integration"
```

---

## Task 10: Calendar Tab

**Files:**
- Create: `src/lib/features/festivals/components/calendar/FestivalCalendar.svelte`
- Create: `src/lib/features/festivals/components/calendar/FestivalMonthView.svelte`
- Create: `src/lib/features/festivals/components/calendar/FestivalDayCell.svelte`
- Create: `src/lib/features/festivals/components/calendar/FestivalCalendarEntry.svelte`
- Modify: `src/lib/features/festivals/FestivalModule.svelte` — Replace calendar placeholder

- [ ] **Step 1: Create FestivalCalendarEntry**

Small pill/chip component representing a calendar item. Two variants:
- Festival date: shows festival name, colored by tracker status
- Application deadline: shows "Deadline: [name]", urgent red styling when ≤7 days away

- [ ] **Step 2: Create FestivalDayCell**

Adapted from Ringmaster's DayCell pattern. Shows day number, up to 3 FestivalCalendarEntry pills, overflow count. Click navigates to day detail or opens the festival.

- [ ] **Step 3: Create FestivalMonthView**

Adapted from Ringmaster's MonthView. 7-column grid, weeks as rows. Uses `date-fns` for month/week calculations. Groups tracked festivals and their deadlines by date into a `Map<string, CalendarItem[]>`. Navigation arrows for month switching.

- [ ] **Step 4: Create FestivalCalendar**

Wrapper that manages current month state and renders FestivalMonthView. Loads tracked festivals from state (only festivals where user has a tracker entry). Transforms Festival + deadline data into calendar items.

- [ ] **Step 5: Wire into FestivalModule**

Replace calendar placeholder.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/festivals/components/calendar/ src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): add calendar tab adapted from Ringmaster pattern"
```

---

## Task 11: My Workshops Tab (Teaching Portfolio)

**Files:**
- Create: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`
- Create: `src/lib/features/festivals/components/portfolio/WorkshopTemplateCard.svelte`
- Create: `src/lib/features/festivals/components/portfolio/BioEditor.svelte`
- Modify: `src/lib/features/festivals/FestivalModule.svelte` — Replace workshops placeholder

- [ ] **Step 1: Create WorkshopTemplateCard**

Card for a single workshop template. Shows: title, level badge, props tags, description (truncated with expand), themes. Edit button opens inline editor. Copy button copies description to clipboard. Delete button with confirmation.

- [ ] **Step 2: Create BioEditor**

List of bio versions. Each shows: label, text with character count display (computed from `text.length`), copy button, edit/delete buttons. "Add Bio" button at bottom. Inline editing with textarea.

- [ ] **Step 3: Create WorkshopPortfolioEditor**

Full tab content. Sections:
- **Workshops** — list of WorkshopTemplateCards + "Add Workshop" button
- **Bios** — BioEditor component
- **Performance Credits** — editable list of strings
- **Performance Videos** — editable list of YouTube URLs
- **Social Links** — form fields for website, instagram, facebook, youtube, tiktok
- **Insurance** — provider name, expiration date
- **About** — home city, country, years teaching, years performing

All changes auto-save via `state.savePortfolio()` with debounce.

On first load, if portfolio is null, seed with `AUSTEN_PORTFOLIO_SEED` data (for Austen's account only, based on UID check).

- [ ] **Step 4: Wire into FestivalModule**

Replace workshops placeholder.

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/festivals/components/portfolio/ src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): add My Workshops tab with teaching portfolio editor"
```

---

## Task 12: Festival Submission & Moderation

**Files:**
- Create: `src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte`
- Create: `src/lib/features/festivals/components/moderation/ModerationQueue.svelte`

- [ ] **Step 1: Create FestivalSubmissionForm**

Accessible via a "Submit a Festival" button in the Discover tab. Modal/drawer form with required fields: name, city, country, dates, websiteUrl. Optional: venue, applicationUrl, description, tags, seeking flags. On submit, geocodes city+country to coordinates using existing GeocodingService, then saves to `festivalSubmissions` collection.

- [ ] **Step 2: Create ModerationQueue**

Admin-only view (check Austen's UID). Lists pending submissions with approve/reject buttons. Approve creates a new festival document via FestivalSubmissionReviewer. Shown as a sub-section within the Discover tab when the current user is admin.

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/festivals/components/submit/ src/lib/features/festivals/components/moderation/
git commit -m "feat(festivals): add festival submission form and moderation queue"
```

---

## Task 13: Seed Festival Data into Firestore

**Files:**
- Create: `scripts/seed-festivals.cjs` — One-time script to populate Firestore

- [ ] **Step 1: Create seeding script**

Node.js script that reads `docs/reference/festival-seed-data.json` (from the web scraper) plus hardcoded known festivals from email history, and writes them to the `festivals` Firestore collection. Uses Firebase Admin SDK or the client SDK with auth. Also seeds Austen's application history into `userFestivalTracking`.

- [ ] **Step 2: Run seed script**

Run: `node scripts/seed-festivals.cjs`
Expected: Festivals appear in Firestore, application history populated

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-festivals.cjs
git commit -m "feat(festivals): add Firestore seeding script for festival data"
```

---

## Task 14: Integration Verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 2: Type check**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 3: Manual verification**

Navigate to the Festivals module in the running app. Verify:
- Tab navigation works (Discover, Map, Calendar, My Workshops)
- Festival cards render with data from Firestore
- Filters update the feed
- Map shows pins with clustering at world zoom
- Calendar shows tracked festivals
- My Workshops shows portfolio data with copy buttons
- Tracker status can be updated on a festival
- Detail view opens and shows all sections

- [ ] **Step 4: Final commit**

```bash
git add src/lib/features/festivals/
git commit -m "feat(festivals): complete Festival Hub module integration"
```
