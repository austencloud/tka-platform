---
status: backlog
value: 2
effort: S
remaining: "Act editing modal, performer portfolio completion"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Applications Tab: Expanding "My Workshops" to Cover Teaching + Performance

**Date:** 2026-03-26
**Status:** Exploratory
**Author:** Austen Cloud + Claude

---

## Problem

The current "My Workshops" tab frames the portfolio as teaching-only. But Austen (and most flow artists applying to festivals) both teaches and performs. The existing data model already captures both sides:

- Two bio types (teaching bio, performing bio)
- Performance credits (troupes/companies)
- Performance videos (YouTube links)
- `yearsTeaching` and `yearsPerforming` fields
- The tracker already has `appliedAs: ("instructor" | "performer")[]`
- Festivals already have `seekingInstructors` and `seekingPerformers` flags

The missing piece: there's no way to define a **performance act** the way you can define a workshop. A workshop has a title, level, props, and description. An act needs its own equivalent structure: title, duration, performer count, props, requirements, and a video reference.

---

## What's an "Act"?

A performance act is a self-contained show piece you can submit to a festival. Examples from Austen's world:

- "Fire Ensemble" -- 4-person synchronized staff routine, 8 minutes, needs fire safety + 20x20 stage
- "Solo Staff Manipulation" -- solo, 5 minutes, can be LED or fire, needs 10x10 minimum
- "Contact Juggling Ambient" -- solo roaming act, 30-60 minutes, no stage needed, crystal balls

Acts differ from workshops in important ways:

| | Workshop | Act |
|---|---------|-----|
| Goal | Teach skills | Entertain audience |
| Duration | 60-90 min typical | 3-15 min typical (or "roaming") |
| Participants | Students | Performers only |
| Level | Beginner through advanced | N/A |
| Requirements | Teaching space, handouts | Stage dimensions, safety, sound, lighting |
| Performer count | Solo instructor (usually) | Solo, duo, or ensemble |
| Video | Optional reference | Essential (festivals want to see the act) |

---

## Naming Options

### Option A: "Applications"

**Rationale:** The tab's purpose is to prepare materials for festival applications. Everything in it (workshops, acts, bios, credits, videos) exists to be submitted to festivals.

| Pros | Cons |
|------|------|
| Accurately describes the purpose | Could be confused with "submitted applications" (the tracker) |
| Covers both teaching and performing | Slightly generic |
| Action-oriented (you're applying) | Doesn't describe the *content*, describes the *use* |

Tab label: "Applications"
Internal ID: `applications`

### Option B: "Portfolio"

**Rationale:** This is your professional portfolio. Workshops you teach, acts you perform, your bios, credits, videos. It's the collection of materials that represents you.

| Pros | Cons |
|------|------|
| Industry-standard term for this kind of collection | Could imply a public-facing page (which doesn't exist yet) |
| Naturally includes both teaching and performing | Slightly passive -- it's a noun, not an action |
| Already used internally (`TeachingPortfolio` type, `portfolioRepo`) | |

Tab label: "Portfolio"
Internal ID: `portfolio`

### Option C: "My Portfolio"

Same as Option B but with the possessive. The other tabs are "Discover", "Map", "Calendar" -- none use "My". Adding "My" makes it feel more personal but breaks the naming pattern.

Tab label: "My Portfolio"
Internal ID: `portfolio`

### Recommendation

**Option B: "Portfolio"** is the strongest. It matches the existing internal naming (`TeachingPortfolio`, `portfolioRepo`, `loadPortfolio`). It naturally encompasses both teaching materials (workshops) and performance materials (acts). The rename from `TeachingPortfolio` to `Portfolio` is a clean conceptual expansion. "Applications" risks confusion with the application tracker.

---

## Data Model: Three Options

### Option 1: Add `acts` to existing `TeachingPortfolio`, rename to `Portfolio`

```typescript
// Rename file: teaching-portfolio.ts -> portfolio.ts

export interface ActTemplate {
  id: string;
  title: string;
  description: string;
  duration: string;            // "8 minutes", "30-60 min roaming"
  performerCount: number;      // 1 = solo, 2 = duo, 3+ = ensemble
  performerCountLabel?: string; // "quartet", "ensemble of 4-6"
  props: string[];
  fireAct: boolean;
  requirements: string[];      // "20x20 stage", "fire safety team", "PA system"
  videoUrl?: string;           // reference to a performance video
  imageUrl?: string;
}

export interface Portfolio {
  userId: string;
  classes: WorkshopTemplate[];  // keep "classes" for Firestore compat
  acts: ActTemplate[];          // NEW
  bios: BioVersion[];
  performanceCredits: string[];
  performanceVideos: string[];
  socialLinks: { ... };
  insuranceInfo?: { ... };
  homeCity: string;
  homeCountry: string;
  yearsTeaching: number;
  yearsPerforming: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Migration:** Existing Firestore docs don't have `acts`. The loader returns `acts: []` as default when missing. No migration script needed.

**Rename scope:** `TeachingPortfolio` -> `Portfolio` across ~12 files. `IWorkshopPortfolioRepository` -> `IPortfolioRepository`. `WorkshopPortfolioRepository` -> `PortfolioRepository`. The Firestore collection path stays the same (no data migration).

### Option 2: Keep `TeachingPortfolio` name, just add `acts`

Minimal change. Add `acts: ActTemplate[]` to the existing interface. Don't rename anything. The name becomes inaccurate ("teaching" portfolio with performance acts) but the blast radius is zero.

### Option 3: Split into separate collections

`workshops` collection and `acts` collection as separate Firestore subcollections under the user's portfolio doc. Over-engineered for the current scale. Not recommended.

### Recommendation

**Option 1.** The rename is mechanical (find-and-replace across ~12 files) and makes the codebase accurately describe what it contains. Keeping the Firestore collection path unchanged means zero data migration.

---

## Section Organization

Current layout (top to bottom):
1. Workshops
2. Bios
3. Profile (social links, about info, credits)
4. Performance Videos

### Proposed layout: Two-column top sections

```
┌─────────────────────────────────────┐
│  Workshops          │  Acts         │
│  [card] [card]      │  [card]       │
│  [+ Add Workshop]   │  [+ Add Act]  │
├─────────────────────┴───────────────┤
│  Bios                               │
│  [Teaching Bio] [Performing Bio]    │
├─────────────────────────────────────┤
│  Profile                            │
│  Social Links │ About │ Credits     │
├─────────────────────────────────────┤
│  Performance Videos                 │
│  [thumbnail] [thumbnail]            │
└─────────────────────────────────────┘
```

On mobile, the two-column top collapses to stacked: Workshops first, Acts second.

**Alternative: Tabbed sub-sections.** Instead of scrolling through all sections, put "Teaching" and "Performing" as sub-tabs within the Portfolio tab. Teaching shows workshops + teaching bio. Performing shows acts + performing bio + credits + videos. Profile stays shared.

This is cleaner but adds navigation depth. For now, the scrollable layout is simpler and shows everything at once. Sub-tabs can come later if the page gets long.

---

## Act Form Fields

The act creation form (modal, same pattern as workshop form):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | text | yes | "Fire Ensemble", "Solo LED Staff" |
| Description | textarea | yes | What the act is, what the audience sees |
| Duration | text | yes | Free text: "8 minutes", "30-60 min roaming" |
| Performers | number + label | yes | Count (1-20) + optional label ("quartet") |
| Props | tag input | yes | Same as workshop: comma-separated |
| Fire act | toggle | yes | Determines safety requirements |
| Requirements | tag input | no | "20x20 stage", "fire safety", "PA system" |
| Video | URL | no | YouTube/Vimeo link. Could also reference from Performance Videos list |
| Image | upload | no | Promo photo for the act |

---

## Festival Application Flow

The existing tracker already supports `appliedAs: ("instructor" | "performer")[]`. When a user applies to a festival:

1. Festival detail view shows "Seeking Instructors" and/or "Seeking Performers" badges (already exists)
2. User clicks "Apply" and selects role(s): instructor, performer, or both
3. **If instructor:** user selects which workshops to include from their portfolio
4. **If performer:** user selects which acts to include (NEW)
5. The tracker stores both `workshopsSubmitted: string[]` and a new `actsSubmitted: string[]`

The tracker model change:

```typescript
export interface UserFestivalTracker {
  // ... existing fields
  workshopsSubmitted: string[];   // existing
  actsSubmitted: string[];        // NEW -- act template IDs
}
```

---

## Rename Blast Radius

Files that reference `TeachingPortfolio` or `WorkshopPortfolio`:

| File | Change |
|------|--------|
| `domain/models/teaching-portfolio.ts` | Rename file + types |
| `data/portfolio-seed.ts` | Update import + add seed acts |
| `services/contracts/IWorkshopPortfolioRepository.ts` | Rename file + interface |
| `services/implementations/WorkshopPortfolioRepository.ts` | Rename file + class |
| `state/festival-state.svelte.ts` | Update imports + types |
| `context/festival-context.ts` | Update types (if exposed) |
| `components/portfolio/WorkshopPortfolioEditor.svelte` | Rename file, add Acts section |
| `components/portfolio/WorkshopTemplateCard.svelte` | No change (workshops still exist) |
| `components/portfolio/BioEditor.svelte` | Update import |
| `FestivalModule.svelte` | Update import |
| `tab-definitions.ts` | Change label + id |
| DI container | Update registration |

~12 files. All mechanical renames, no logic changes except adding the Acts section to the editor.

---

## What This Spec Does NOT Cover

- **Public portfolio page.** A shareable URL where festivals can view your portfolio. Separate feature.
- **Application submission integration.** Actually sending portfolio data to festival organizers. Currently the app just tracks status; real submission is external.
- **Act collaboration.** Tagging other performers in an ensemble act. Would need user references.
- **Video upload.** Acts reference YouTube URLs. Direct video hosting is a different problem.

---

## Next Steps (if approved)

1. Rename `TeachingPortfolio` -> `Portfolio`, `WorkshopPortfolioRepository` -> `PortfolioRepository`
2. Add `ActTemplate` interface and `acts: ActTemplate[]` to `Portfolio`
3. Add `actsSubmitted: string[]` to `UserFestivalTracker`
4. Build act form (modal, mirrors workshop form pattern)
5. Build `ActTemplateCard.svelte` (mirrors `WorkshopTemplateCard.svelte`)
6. Add Acts section to the portfolio editor
7. Update tab label from "My Workshops" to "Portfolio"
8. Update portfolio seed with sample acts
