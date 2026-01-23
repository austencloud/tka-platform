# TKA Scribe MVP Guidelines

> **Target Release**: This week
> **Last Updated**: 2024-12-31
> **Version**: 0.8.0 (MVP)

---

## Executive Summary

The MVP enables users to **create, save, navigate, and share sequences** in animation, image, or video form. This document defines what's in scope, what's out, critical blockers, and the testing checklist.

---

## 1. MVP Scope Definition

### What Regular Users See

| Module        | Status    | Tabs/Features                            |
| ------------- | --------- | ---------------------------------------- |
| **Dashboard** | ✅ In MVP | Landing page, navigation hub             |
| **Create**    | ✅ In MVP | Assemble, Construct, Generate (no Spell) |
| **Discover**  | ✅ In MVP | Gallery, Collections, Creators           |
| **Premium**   | ✅ In MVP | Upsell page for non-premium users        |

### What's Hidden from Regular Users (Admin/Tester Only)

| Module      | Role Required | Reason                          |
| ----------- | ------------- | ------------------------------- |
| Learn       | Admin         | Not production ready            |
| Compose     | Admin         | Advanced animation editing      |
| Train       | Admin         | Prop detection training         |
| Library     | Admin         | Being prepared for next release |
| Feedback    | Tester+       | Internal feedback system        |
| ML Training | Tester        | Data collection tool            |
| Admin       | Admin         | System management               |
| 3D Viewer   | Admin         | Experimental                    |
| Choreo Card   | Admin         | Internal tool                   |
| Write       | Admin         | Internal tool                   |
| Spell Tab   | Admin         | Create tab not ready for users  |

---

## 2. Core User Workflows

### Workflow 1: Create a Sequence

```
User opens Create → Picks method (Assemble/Construct/Generate) → Builds sequence → Sequence appears in workspace
```

**Entry Points:**

- Dashboard → Create module
- Bottom nav (mobile) / Sidebar (desktop)

**Methods Available:**

1. **Assemble** - Beginner-friendly, 6 choices per hand, step-by-step
2. **Construct** - Full option picker, step-by-step beat building
3. **Generate** - Parameter-based auto-generation (length, level, LOOP type)

**Exit Criteria:**

- User has a visible sequence in the workspace
- Beat grid shows all created beats
- Undo/redo works

---

### Workflow 2: Save a Sequence

```
User creates sequence → Clicks Save → Enters metadata → Sequence saved to library
```

**Current State:** ⚠️ PARTIAL - Component exists, trigger button missing

**Required Fix:**

- Add "Save to Library" button to ButtonPanel
- Wire button to `panelState.openSaveToLibraryPanel()`

**Save Panel Features:**

- Name input (auto-populated from display word)
- Visibility toggle (public/private)
- Tags input
- Notes field
- Progress indicator (5-step save)

---

### Workflow 3: Navigate Through Beats

```
User views sequence → Taps/clicks beats → Selected beat highlighted → Can scroll through long sequences
```

**Current State:** ✅ WORKING

**Features:**

- Beat grid with tap-to-select
- Scroll state managed
- Selected beat visually highlighted
- Animation preview available

---

### Workflow 4: Share a Sequence

```
User creates sequence → Opens Share Hub → Selects format → Exports/shares
```

**Current State:** ⚠️ CRITICAL GAPS

**What Works:**

- Share Hub drawer opens
- Format selection UI (Animation/Static/Performance)
- Settings panels render

**What's Broken:**

- Sequence data not syncing to Share Hub (infinite loop bug)
- Export callback not implemented in Create module
- Performance video completely unimplemented

**MVP Scope for Share:**
| Format | MVP Status | Notes |
|--------|------------|-------|
| Static Image (PNG) | ✅ Fix & ship | Core requirement |
| Animation (MP4) | ⚠️ Stretch | If time permits |
| Performance Video | ❌ Cut | Remove from UI or mark "Coming Soon" |
| Composite | ❌ Cut | Remove from MVP |

---

## 3. Critical Blockers

### P0 - Must Fix Before Release

| Issue                         | Location                     | Impact                          | Effort |
| ----------------------------- | ---------------------------- | ------------------------------- | ------ |
| **Save button missing**       | `ButtonPanel.svelte`         | Users can't save sequences      | 10 min |
| **Share Hub sequence sync**   | `ShareHubPanel.svelte:53-69` | Share Hub has no data to export | 30 min |
| **Static image export**       | `SingleMediaView.svelte`     | No actual export happens        | 2 hrs  |
| **Performance video removal** | `ShareHubPanel.svelte`       | Shows broken feature            | 15 min |

### P1 - Should Fix Before Release

| Issue                          | Location                    | Impact                          | Effort |
| ------------------------------ | --------------------------- | ------------------------------- | ------ |
| Console.logs in DiscoverFilter | `DiscoverFilter.ts:217-278` | Debug noise in production       | 5 min  |
| Edit button discoverability    | `ButtonPanel.svelte`        | Users don't know editing exists | 15 min |
| Filter result count            | `HybridFilterPanel.svelte`  | Users can't see filter impact   | 30 min |

### P2 - Nice to Have

| Issue                     | Location              | Impact              | Effort |
| ------------------------- | --------------------- | ------------------- | ------ |
| Animation MP4 export      | Compose services      | Full share workflow | 4 hrs  |
| Sort direction in service | `DiscoverSorter.ts`   | Clean architecture  | 30 min |
| Favorites toggle toast    | `SequenceCard.svelte` | User feedback       | 15 min |

---

## 4. Module-by-Module Status

### CREATE Module: ✅ MVP Ready

| Tab       | Status    | Notes                           |
| --------- | --------- | ------------------------------- |
| Assemble  | ✅ Ready  | Beginner-friendly, step-by-step |
| Construct | ✅ Ready  | Full option picker working      |
| Generate  | ✅ Ready  | All parameters functional       |
| Spell     | ❌ Hidden | Admin-only, not ready           |

**Post-Creation Features:**
| Feature | Status | Fix Required |
|---------|--------|--------------|
| Sequence Actions Panel | ✅ Working | Improve button visibility |
| Save to Library | ⚠️ Hidden | Add trigger button |
| Undo/Redo | ✅ Working | Tab-scoped |
| Animation Preview | ✅ Working | Play button in toolbar |

---

### DISCOVER Module: ✅ MVP Ready

| Tab         | Status   | Notes                   |
| ----------- | -------- | ----------------------- |
| Gallery     | ✅ Ready | Virtualized, responsive |
| Collections | ✅ Ready | Curated playlists       |
| Creators    | ✅ Ready | Community profiles      |

**Features:**
| Feature | Status | Notes |
|---------|--------|-------|
| Sequence Cards | ✅ Ready | Prop-aware thumbnails |
| Filtering (8 types) | ✅ Ready | Remove console.logs |
| Sorting | ✅ Ready | Direction logic manual but works |
| Mobile Immersive | ✅ Ready | Full-screen detail view |
| Desktop Side Panel | ✅ Ready | 35% width detail panel |
| Favorites | ✅ Ready | Consider adding toast |

---

### SHARE Functionality: ⚠️ Needs Work

| Format            | Status     | MVP Decision     |
| ----------------- | ---------- | ---------------- |
| Static PNG        | ⚠️ Broken  | **Must fix**     |
| Animation MP4     | ⚠️ Partial | Stretch goal     |
| Performance Video | ❌ Broken  | **Cut from MVP** |
| Composite         | ❌ Stub    | **Cut from MVP** |

**Critical Path:**

1. Fix sequence sync bug in ShareHubPanel
2. Implement static image export callback
3. Hide/disable Performance and Composite modes
4. Add loading/error states

---

## 5. User Roles & Access

### Regular User (MVP Target)

- Dashboard, Create (3 tabs), Discover (3 tabs)
- PNG export (when fixed)
- Social sharing via Web Share API

### Premium User

- Same as regular + advanced filters

### Tester

- Same as premium + Feedback module + video/GIF export

### Admin

- Everything visible for testing

---

## 6. Testing Checklist

### Create Module Tests

- [ ] **Construct Flow**
  - [ ] Select start position (Diamond/Box grid)
  - [ ] Add 3+ beats via option picker
  - [ ] Verify beat grid updates
  - [ ] Undo removes last beat
  - [ ] Redo restores beat

- [ ] **Generate Flow**
  - [ ] Set length to 8
  - [ ] Set level to 2
  - [ ] Click Generate
  - [ ] Verify sequence appears
  - [ ] Verify beat count matches length

- [ ] **Assemble Flow**
  - [ ] Complete welcome screen
  - [ ] Tap 3+ positions for blue hand
  - [ ] Tap matching positions for red hand
  - [ ] Select rotation direction
  - [ ] Verify sequence created

- [ ] **Save Flow** (after button added)
  - [ ] Create any sequence
  - [ ] Click Save button
  - [ ] Enter name
  - [ ] Set visibility
  - [ ] Confirm save
  - [ ] Verify success message

### Discover Module Tests

- [ ] **Gallery Browsing**
  - [ ] Page loads with sequences
  - [ ] Scroll through 50+ sequences smoothly
  - [ ] Tap card opens detail panel
  - [ ] Detail panel shows correct sequence

- [ ] **Filtering**
  - [ ] Filter by difficulty level
  - [ ] Filter by starting letter
  - [ ] Filter by favorites
  - [ ] Clear filter returns all sequences

- [ ] **Mobile Experience**
  - [ ] Cards display in 2-3 column grid
  - [ ] Detail opens full-screen
  - [ ] Swipe gestures work
  - [ ] Close button returns to grid

### Share Tests (after fixes)

- [ ] **Static Image Export**
  - [ ] Create sequence
  - [ ] Open Share Hub
  - [ ] Select Static format
  - [ ] Click Export
  - [ ] Image downloads successfully
  - [ ] Image contains correct sequence

---

## 7. Performance Benchmarks

| Metric                      | Target  | Current     |
| --------------------------- | ------- | ----------- |
| Gallery load (50 sequences) | < 2s    | ✅ OK       |
| Sequence generation         | < 1s    | ✅ OK       |
| Option picker scroll        | 60fps   | ✅ OK       |
| Share Hub open              | < 500ms | ⚠️ Untested |
| Image export                | < 5s    | ⚠️ Untested |

---

## 8. Known Limitations (Ship Anyway)

These issues are acceptable for MVP:

1. **No multi-select filters** - Can only filter by one criteria at a time
2. **Manual sort direction** - Code reverses array instead of service
3. **No sequence import** - Users can't import from file (tester-only)
4. **No delete from Discover** - Stub only, not implemented
5. **Tablet breakpoint unclear** - May show desktop UI on smaller tablets
6. **No offline support** - Requires network connection

---

## 9. Post-MVP Roadmap

### v0.8.1 - Library Integration

- [ ] Library module for regular users
- [ ] Save sequences to collections
- [ ] Manage saved sequences

### v0.8.2 - Enhanced Sharing

- [ ] Animation MP4 export
- [ ] GIF export
- [ ] Social media presets

### v0.9.0 - Advanced Features

- [ ] Performance video recording
- [ ] Composite exports
- [ ] Spell tab for users

---

## 10. Release Checklist

### Before Tagging

- [ ] All P0 blockers resolved
- [ ] Console.logs removed from DiscoverFilter
- [ ] Performance video hidden from UI
- [ ] Composite mode hidden from UI
- [ ] Create module tests pass
- [ ] Discover module tests pass
- [ ] Share (static) test passes

### Release Process

1. `node scripts/release.js -p` (preview)
2. Commit all changes
3. `node scripts/release.js --version 0.8.0 --confirm`
4. `git push origin main && git push origin v0.8.0`
5. `gh release create v0.8.0 --title "v0.8.0 - MVP Release" --notes "..."`
6. `node scripts/archive-feedback.js 0.8.0`
7. `git checkout develop && git merge main && git push`

---

## Quick Reference

### Commands

```bash
# Run dev server
npm run dev

# Run tests
npm test

# Preview release
node scripts/release.js -p

# Check TypeScript
npx tsc --noEmit
```

### Key Files to Edit for Fixes

| Fix              | File                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| Save button      | `src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte`  |
| Share Hub sync   | `src/lib/shared/share-hub/components/ShareHubPanel.svelte`                             |
| Static export    | `src/lib/shared/share-hub/components/single-media/SingleMediaView.svelte`              |
| Hide Performance | `src/lib/shared/share-hub/state/share-hub-state.svelte.ts`                             |
| Console.logs     | `src/lib/features/discover/gallery/display/services/implementations/DiscoverFilter.ts` |

---

_This document is the source of truth for MVP scope. When in doubt, refer here._
