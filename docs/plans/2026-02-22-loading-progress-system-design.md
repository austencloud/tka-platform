# Loading Progress System Design

**Date:** 2026-02-22
**Goal:** Replace every bare loading spinner in the app with context-appropriate progress indicators. Build a Progress Lab for visual comparison before rollout.

---

## Problem

12+ files copy-paste their own `@keyframes spin` border spinner. Full-page gates, panel loading, grid cells, and button actions all show uninformative spinners with no context about duration or progress. The loading UX is inconsistent across contexts and offers zero information to the user about what's happening or how long they'll wait.

## Existing Good Patterns

- **PropAwareThumbnail** — deterministic `current/total` progress bar with beat count, shimmer overlay
- **SaveProgressOverlay** — multi-step indicators (pending/active/completed) + sub-progress bar
- **CaptureProgress / UploadProgress** — `X/Y` counters with progress bars and shimmer
- **Inbox skeletons** — shimmer + staggered fadeIn + reduced-motion support (gold standard)
- **BrowseThumbnailSkeleton** — grid skeleton with per-card shimmer

## Approach

**Lab-first:** Build a Progress Lab tab where loading indicator variants can be compared visually, then pick favorites per context, then roll out.

---

## Phase 1: Progress Lab

New "Progress" tab in the Lab module (`src/lib/features/lab/tabs/ProgressLab.svelte`).

### Lab Sections

| Section | Simulates | Variants |
|---------|-----------|----------|
| **Full-page gate** | Route loading (`/p/[code]`, `/sequence/[id]`, domain detection) | A) Thin top bar (YouTube/GitHub) B) Center card with progress ring C) Skeleton with brand shimmer |
| **Panel loading** | PanelSpinner (browse, collections, challenges) | A) Skeleton shimmer (inbox pattern) B) Indeterminate bar + status text C) Animated dots pulse |
| **Deterministic progress** | Multi-step save, batch ops | A) Linear bar with `X/Y` B) Circular progress ring with % C) Step dots + sub-bar (SaveProgressOverlay style) |
| **Grid cells** | LayeredSequencePreview thumbnails | A) Per-cell shimmer B) Staggered fade-in C) Micro progress ring per cell |
| **Button actions** | Async operations (spell, export) | A) Inline spinner B) Button morphs to progress bar C) Button fill sweep |

### Lab Controls

- **Play button** per section to trigger simulated loading
- **Variant selector** to switch between A/B/C styles
- **Speed control** (0.5x / 1x / 2x) to see animations at different paces
- **Global accent color** picker to see how variants adapt to `--theme-accent`
- **Light/dark toggle** to verify both background modes
- **Reduced-motion toggle** to verify accessibility compliance

---

## Phase 2: Shared Component Library

Location: `src/lib/shared/components/loading/`

### Primitives

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `IndeterminateBar.svelte` | Thin animated bar (YouTube-style sliding/pulsing) | `color?`, `height?`, `position?: 'top' \| 'inline'` |
| `ProgressBar.svelte` | Deterministic fill bar with optional label | `percent`, `label?`, `showPercent?`, `color?`, `height?` |
| `ProgressRing.svelte` | Circular SVG progress indicator | `percent`, `size?`, `strokeWidth?`, `color?`, `label?` |
| `ShimmerBlock.svelte` | Configurable shimmer placeholder rectangle | `width`, `height`, `borderRadius?`, `delay?` |
| `StepProgress.svelte` | Multi-step indicator (pending/active/complete dots) | `steps: {label, icon?}[]`, `currentStep`, `orientation?` |
| `LoadingGate.svelte` | Full-page route loading wrapper | `variant`, `message?` |

### Design Principles

All components:
- Default to `var(--theme-accent)` (adapts to background luminance)
- Accept `color` override for context-specific accents
- Respect `prefers-reduced-motion` — show static fallback states
- Use CSS custom properties internally
- Include `role="status"` and `aria-label` for screen readers
- Use `--duration-emphasis` and `--duration-fast` tokens (not hardcoded durations)

---

## Phase 3: Rollout

After favorites are picked in the lab, replace loading instances in waves.

### Wave 1: Full-page gates (5 files, highest visibility)

| File | Current | Replacement |
|------|---------|-------------|
| `src/routes/+page.svelte` | Hardcoded border-spin (indigo) | `LoadingGate` with chosen variant |
| `src/routes/[...path]/+page.svelte` | Hardcoded border-spin (green) | `LoadingGate` with chosen variant |
| `src/routes/p/[code]/+page.svelte` | Hardcoded border-spin (rose) | `LoadingGate` with chosen variant |
| `src/routes/sequence/[id]/+page.svelte` | Hardcoded border-spin | `LoadingGate` with chosen variant |
| `src/routes/auth/login/+page.svelte` | `<div class="spinner">` | `LoadingGate` with chosen variant |

### Wave 2: Panel loading (7+ files)

Replace `PanelSpinner.svelte` internals or create `PanelLoading.svelte` that uses the chosen indeterminate variant. All consumers of `PanelState type="loading"` auto-upgrade.

Files affected:
- `CreatorsPanel.svelte`
- `UserProfilePanel.svelte`
- `CollectionsBrowsePanel.svelte`
- `ChallengesPanel.svelte`
- `SequencePickerModal.svelte`
- `DuetBrowserPanel.svelte`
- `ShameQueuePanel.svelte`

### Wave 3: Grid cells

Add per-cell loading indicator to `LayeredSequencePreview.svelte` using the chosen grid-cell variant.

### Wave 4: Button actions (~5 files)

Replace `fa-spinner fa-spin` inline patterns in:
- `SpellPanel.svelte`
- `SpellInputToolbar.svelte`
- `ExportPhase.svelte`
- `TrainChallengeManager.svelte`
- Auth button components

### Wave 5: Cleanup

- Delete duplicated `@keyframes spin` from 12+ files
- Remove unused `PanelSpinner.svelte` if fully replaced
- Consolidate remaining one-off loading patterns

---

## Non-Goals

- Not changing PropAwareThumbnail's existing progress bar (it's already excellent)
- Not adding progress to truly instant operations (domain detection is ~1 tick)
- Not replacing the 3D avatar loading indicator (it's in-scene, unique by design)
- Not adding fake progress to indeterminate operations (no "estimated time remaining" guessing)

## Success Criteria

- Zero bare `@keyframes spin` copy-paste spinners remain
- Every loading state communicates WHAT is loading via text or skeleton shape
- Deterministic operations show real progress (not just "loading...")
- All loading indicators respect `prefers-reduced-motion`
- Loading UX is visually consistent within each context category
