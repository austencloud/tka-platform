# Sequence Viewer Redesign Plan v2.0

## Executive Summary

Transform the Sequence Viewer from a feature-accumulating modal into a focused viewing hub. This plan is validated against:
- Critical self-audit identifying 10+ gaps in v1.0
- 2024-2026 UX research from Netflix, Material Design, Apple HIG
- Mobile gesture patterns from TikTok, Instagram, YouTube
- WCAG 2.2 accessibility requirements

---

## Problem Statement

The current Sequence Viewer has accumulated features that create confusion:
- Visibility toggles interrupt viewing flow
- Stagger preview brings Compose-level complexity into a casual context
- BPM controls dominate the footer
- Mobile experience is cluttered
- Header title is pushed off-center
- Choreo card doesn't maximize its allocated space

---

## Design Principles (Research-Validated)

1. **"Recede" Philosophy** (Netflix): Once content is chosen, UI should disappear
2. **Context-appropriate complexity**: Power features live in power modules
3. **Mobile-first**: Every pixel earns its place; thumb zone optimization
4. **Progressive disclosure**: Show basics first, reveal depth on demand
5. **Swipe-down dismiss**: The modern native expectation
6. **48px touch targets**: Google's de facto standard (not WCAG's 44px)

---

## Architecture Decisions (Critical Gaps Addressed)

### Decision 1: Viewer-to-Compose Data Contract

**Problem identified in audit:** No mechanism exists for cross-module state transfer.

**Solution:**

```typescript
// New: src/lib/shared/coordinators/sequence-handoff.svelte.ts
interface SequenceHandoff {
  sequence: SequenceData;
  playbackState?: {
    currentStep: number;
    bpm: number;
    isPlaying: boolean;
  };
  returnPath?: string; // For browser back behavior
}

// Store in sessionStorage with key 'tka_sequence_handoff'
// URL pattern: /compose?handoff=true
```

**Flow:**
1. User clicks "Open in Compose" in Viewer
2. Viewer serializes sequence + playback state to sessionStorage
3. `goto('/compose?handoff=true')` triggers navigation
4. Compose module checks for handoff on mount
5. If handoff exists: load sequence into "primary" slot, default to "single" mode
6. Handoff data cleared after consumption

**Return journey:** Browser back returns to previous URL. Viewer state is NOT preserved (acceptable - user chose to leave).

### Decision 2: Compose Landing Experience

**Problem identified:** Compose expects mode selection FIRST, then sequence assignment.

**Solution:** Add "handoff mode" to Compose that inverts the flow:

```typescript
// In compose-module-state.svelte.ts
if (urlParams.has('handoff')) {
  const handoff = consumeSequenceHandoff();
  if (handoff) {
    // Pre-select single mode
    arrangeState.setMode('single');
    // Assign to primary slot
    arrangeState.assignSequence('primary', handoff.sequence);
    // Show arrangement presets as toast/bottom sheet
    showArrangementPresetPicker();
  }
}
```

**Preset picker options:**
- Solo (current) - already applied
- Mirror (duet) - transforms sequence
- Stagger (trio+) - adds offset performers

This gives immediate gratification (sequence already visible) while offering customization.

### Decision 3: Auth for "Save to Library"

**Problem identified:** What happens if user isn't logged in?

**Solution:** Prompt to sign in with clear value proposition.

```
┌─────────────────────────────────────────┐
│  Save to Your Library                    │
│                                          │
│  Sign in to save sequences and access    │
│  them across all your devices.           │
│                                          │
│  [Sign in with Google]                   │
│  [Continue without saving]               │
└─────────────────────────────────────────┘
```

"Continue without saving" dismisses modal, returns to viewer. No local-only save (creates data loss expectations).

### Decision 4: LAN Sync During Transition

**Problem identified:** What happens to sync when navigating to Compose?

**Solution:** Disconnect with notification.

When user clicks "Open in Compose" while LAN synced:
1. Show toast: "Disconnecting sync to open Compose..."
2. `lanSyncState.disconnect()` called before navigation
3. Connected peer sees their viewer remain (now solo)

Rationale: Compose doesn't support sync, and maintaining phantom sync adds complexity.

### Decision 5: Export Visibility Controls

**Problem identified:** Plan v1.0 said "remove visibility toggles" but export mode needs them.

**Solution:** Visibility controls have TWO contexts that remain separate:

| Context | Visibility Controls | Location |
|---------|---------------------|----------|
| Viewing | Use global settings from Settings module | NOT in viewer |
| Exporting | Export-specific settings | Remain in export flow |

The tap-to-expand pane interaction changes:
- **Before:** Tap pane → expand → show visibility chips
- **After:** Tap pane → expand → just maximized view, no chips

Export mode is entered via "Export" action button and KEEPS its visibility controls.

---

## Phase 1: Immediate Fixes (This Session)

### 1.1 Modal Sizing (90% with clickable backdrop)
```css
@media (min-width: 768px) {
  :global(.sequence-details-modal.base-modal[data-size="full"]) {
    width: 100vw;
    height: 100vh;
    padding: 5vh 5vw; /* Creates 5% clickable backdrop on each side */
    background: transparent;
  }

  :global(.sequence-details-modal .modal-content-wrapper) {
    background: var(--theme-panel-bg);
    border-radius: 16px;
    /* ... shadow, overflow */
  }
}
```

### 1.2 Header Layout (True Center Title)

**Current problem:** Flexbox justify-between pushes title based on button count.

**Solution:** CSS Grid with overlay positioning.

```css
.details-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.header-left {
  justify-self: start;
}

.header-center {
  /* Grid column 2 = always centered */
  text-align: center;
}

.header-right {
  justify-self: end;
}
```

Title will be centered regardless of button count on left/right.

### 1.3 LayeredSequencePreview Sizing

**Investigation needed:** Read `LayeredSequencePreview.svelte` to understand why it doesn't fill space.

**Likely fix:**
```css
.preview-container {
  flex: 1;
  min-height: 0; /* Critical for flex children with overflow */
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
```

### 1.4 BPM Controls Demotion

**Research finding:** Netflix uses two vertically-stacked control bars on mobile, not one cramped horizontal bar.

**New footer architecture:**

```
Desktop:
┌─────────────────────────────────────────────────────────────┐
│ [◄◄] [▶] [►►]  120 BPM ▼  │  [Save] [Compose] [Share] [···] │
└─────────────────────────────────────────────────────────────┘

Mobile (stacked):
┌───────────────────────────────────┐
│ [Save]   [Compose]   [Share]      │  ← Row 1: Primary actions
├───────────────────────────────────┤
│ [◄◄] [▶] [►►]   120 BPM ▼        │  ← Row 2: Playback (auto-hide)
└───────────────────────────────────┘
```

**Mobile playback auto-hide:**
- Controls visible when modal opens
- Auto-hide after 3 seconds of playback
- Tap animation area to toggle
- Stay visible when paused (Netflix pattern)

---

## Phase 2: Feature Removal & Redirection

### 2.1 Remove Stagger Preview (Redirect to Compose)

**Files affected:**
- `SequenceDetailsModal.svelte` - Remove StaggerModeModal import and rendering
- `stagger/StaggerModeModal.svelte` - Archive (don't delete yet)
- `stagger/*` - All related components archived

**Button handler change:**

```typescript
// Before
onclick={() => { staggerModeOpen = true; setStaggerModeUrl(true); }}

// After
onclick={() => handleOpenInCompose('stagger')}

async function handleOpenInCompose(preset?: 'stagger' | 'mirror') {
  // 1. Disconnect LAN sync if active
  if (lanSyncState.isConnected) {
    showToast('Disconnecting sync...', 'info');
    lanSyncState.disconnect();
  }

  // 2. Save handoff data
  saveSequenceHandoff({
    sequence,
    playbackState: { currentStep: currentStepLocal, bpm: bpmLocal, isPlaying: isPlayingLocal },
    preferredPreset: preset
  });

  // 3. Navigate
  await goto('/compose?handoff=true');
}
```

**Compose receives handoff:**
- Checks `preferredPreset` in handoff data
- If 'stagger': pre-select stagger arrangement, show offset picker
- If 'mirror': pre-select mirror mode
- If undefined: default to single mode

### 2.2 Remove Visibility Toggles from View Mode

**Files affected:** `SequenceDetailsModal.svelte`

**Remove:**
```svelte
<!-- DELETE: focus-mode-chips in animation pane -->
{#if editingPane === 'animation'}
  <div class="focus-mode-chips" ...>
    <button>Trails</button>
    <button>TKA</button>
    <button>Word</button>
  </div>
{/if}

<!-- DELETE: focus-mode-chips in preview pane -->
{#if editingPane === 'image'}
  <div class="focus-mode-chips" ...>
    <button>Grid</button>
    <button>Numbers</button>
    <button>TKA</button>
  </div>
{/if}
```

**Keep:** All visibility controls in `{#if isExportMode}` block remain unchanged.

**Settings module update (Phase 2.5):**
Ensure Animation Appearance settings are discoverable:
- Add link in viewer: "Customize appearance in Settings" (shown once, dismissible)
- Verify Settings/Visibility tab has all relevant options

---

## Phase 3: Footer Redesign

### 3.1 New Footer Component

**Create:** `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`

```svelte
<script lang="ts">
  interface Props {
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onSave: () => void;
    onCompose: () => void;
    onShare: () => void;
    onExport: () => void;
    isLoggedIn: boolean;
    controlsVisible: boolean; // For auto-hide
  }
</script>

<footer class="viewer-footer" data-controls-visible={controlsVisible}>
  <!-- Primary actions row (always visible) -->
  <div class="actions-row">
    <button class="action-btn" onclick={onSave}>
      <i class="fas fa-bookmark"></i>
      <span>Save</span>
    </button>
    <button class="action-btn" onclick={onCompose}>
      <i class="fas fa-users"></i>
      <span>Compose</span>
    </button>
    <button class="action-btn" onclick={onShare}>
      <i class="fas fa-share"></i>
      <span>Share</span>
    </button>
    <button class="action-btn" onclick={onExport}>
      <i class="fas fa-download"></i>
      <span>Export</span>
    </button>
  </div>

  <!-- Playback row (auto-hides on mobile during playback) -->
  <div class="playback-row">
    <button onclick={onStepBack} aria-label="Previous step">
      <i class="fas fa-step-backward"></i>
    </button>
    <button onclick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"></i>
    </button>
    <button onclick={onStepForward} aria-label="Next step">
      <i class="fas fa-step-forward"></i>
    </button>
    <BpmSelector {bpm} onChange={onBpmChange} />
  </div>
</footer>
```

### 3.2 Auto-Hide Logic

```typescript
let controlsVisible = $state(true);
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function showControls() {
  controlsVisible = true;
  scheduleHide();
}

function scheduleHide() {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (!isPlayingLocal) return; // Don't hide when paused

  hideTimeout = setTimeout(() => {
    controlsVisible = false;
  }, 3000); // 3 second delay per research
}

// Show on interaction
function handleAnimationTap() {
  if (controlsVisible) {
    controlsVisible = false;
  } else {
    showControls();
  }
}
```

---

## Phase 4: Mobile Optimization

### 4.1 Swipe-Down to Dismiss

**Research validated:** This is the native expectation on both iOS and Android.

**Implementation:**

```typescript
let dragStartY = 0;
let dragCurrentY = 0;
let isDragging = false;

function handleTouchStart(e: TouchEvent) {
  // Only enable drag when at scroll top
  if (contentElement.scrollTop > 0) return;

  dragStartY = e.touches[0].clientY;
  isDragging = true;
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging) return;

  dragCurrentY = e.touches[0].clientY;
  const deltaY = dragCurrentY - dragStartY;

  if (deltaY > 0) {
    // Apply drag transform
    modalElement.style.transform = `translateY(${deltaY}px)`;
    // Reduce opacity as drag progresses
    modalElement.style.opacity = `${1 - (deltaY / 300)}`;
  }
}

function handleTouchEnd() {
  if (!isDragging) return;
  isDragging = false;

  const deltaY = dragCurrentY - dragStartY;

  if (deltaY > 100) { // 100px threshold (~30% on typical modal)
    handleClose();
  } else {
    // Snap back
    modalElement.style.transform = '';
    modalElement.style.opacity = '';
  }
}
```

### 4.2 Remove Fullscreen Button on Mobile

```svelte
{#if !isMobile}
  <ExpandButton
    isExpanded={isFullscreen}
    onclick={enterFullscreen}
    size="small"
  />
{/if}
```

On mobile, tap-to-maximize IS the fullscreen. No separate button needed.

### 4.3 Mobile Header (Minimal)

```svelte
<header class="details-header">
  {#if isMobile}
    <!-- Mobile: Just close button, overflow for rest -->
    <div class="header-left">
      <button class="overflow-btn" onclick={toggleOverflowMenu}>
        <i class="fas fa-ellipsis-h"></i>
      </button>
    </div>
    <div class="header-center">
      <!-- Optional: small title or empty -->
    </div>
    <div class="header-right">
      <button class="close-button" onclick={handleClose}>
        <i class="fas fa-times"></i>
      </button>
    </div>
  {:else}
    <!-- Desktop: Full header -->
    ...
  {/if}
</header>
```

**Overflow menu contains:** Sync, Lights toggle, Share link

### 4.4 Mobile Split View Tap Behavior

```
Initial state:
┌───────────────────────────────────┐
│           ANIMATION               │
│            (60%)                  │
├───────────────────────────────────┤
│         CHOREO CARD               │
│            (40%)                  │
└───────────────────────────────────┘

After tapping animation:
┌───────────────────────────────────┐
│                                   │
│           ANIMATION               │
│           (100%)                  │
│                                   │
│  [tap anywhere to return]         │
└───────────────────────────────────┘
```

Tap again to return to split view. Same for choreo card pane.

---

## Phase 5: Accessibility Compliance

### 5.1 Focus Management

**Modal open:**
```typescript
$effect(() => {
  if (open && modalElement) {
    // Focus first interactive element (close button or content)
    const firstFocusable = modalElement.querySelector('button, [tabindex="0"]');
    firstFocusable?.focus();
  }
});
```

**Pane expand:**
```typescript
function enterEditMode(pane: 'animation' | 'image') {
  editingPane = pane;
  // Announce to screen readers
  announceToScreenReader(`${pane} expanded. Tap again to exit.`);
}
```

**Modal close:**
Focus returns to trigger element (handled by BaseModal's FocusRestore).

### 5.2 Screen Reader Announcements

```typescript
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// Usage:
// On navigation: announceToScreenReader('Opening in Compose module');
// On expand: announceToScreenReader('Animation view expanded');
// On controls hide: announceToScreenReader('Controls hidden. Tap to show.');
```

### 5.3 Required ARIA Attributes

```svelte
<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="sequence-title"
  aria-describedby="sequence-description"
>
  <h2 id="sequence-title">{sequence.word || 'Sequence'}</h2>
  <span id="sequence-description" class="sr-only">
    Viewing sequence with {sequence.steps?.length || 0} steps
  </span>
</dialog>
```

---

## Phase 6: Print Module (Separate Project)

**Note:** This is a SEPARATE initiative, documented here for completeness.

### 6.1 Module Structure
```
/print
  ├── /choreo-cards    (existing game format)
  ├── /poster          (single sequence, large format, light mode)
  └── /practice-sheet  (multiple sequences per page)
```

### 6.2 User Story
"I want to print this sequence and put it on my fridge"

**Flow:**
1. In Viewer, click "Share" → "Print..."
2. Opens Print module with sequence pre-loaded
3. Choose format: Poster (1 sequence, big) or Practice Sheet (multiple)
4. Adjust settings (always light mode for paper)
5. Export as PDF

**This replaces the "light mode export" request** - printing is inherently light mode, and the Print module owns that concern.

---

## Implementation Order

| Phase | Effort | Risk | Dependencies |
|-------|--------|------|--------------|
| 1.1 Modal sizing | 30min | Low | None |
| 1.2 Header centering | 30min | Low | None |
| 1.3 Preview sizing | 1hr | Low | Need to read LayeredSequencePreview |
| 1.4 BPM demotion | 2hr | Medium | Footer redesign |
| 2.2 Remove visibility toggles | 1hr | Low | None |
| 3 Footer redesign | 3hr | Medium | New component |
| 2.1 Stagger redirect | 4hr | High | Compose handoff mechanism |
| 4 Mobile optimization | 4hr | Medium | Gestures, breakpoints |
| 5 Accessibility | 2hr | Low | After other changes |

**Recommended execution:**
1. Phase 1 (this session) - immediate visual fixes
2. Phase 2.2 + Phase 3 (next session) - simplification
3. Phase 2.1 (requires coordination) - redirect to Compose
4. Phase 4 (can parallel with 2.1) - mobile polish
5. Phase 5 (throughout) - accessibility checks

---

## Success Criteria

### Viewer Focus
- [ ] User can view animation and choreo card without distraction
- [ ] No visibility decisions required during casual viewing
- [ ] Tap-to-maximize works smoothly on all devices
- [ ] Swipe-down dismiss works on mobile

### Power User Path
- [ ] "Open in Compose" loads sequence with playback state preserved
- [ ] Clear path to Settings for persistent preferences
- [ ] Export flow unchanged (visibility controls remain there)

### Mobile Excellence
- [ ] Every element has 48px touch target minimum
- [ ] Controls auto-hide after 3 seconds during playback
- [ ] Swipe-down-to-dismiss feels native
- [ ] No wasted space

### Accessibility
- [ ] Focus trapped in modal
- [ ] ESC key closes modal
- [ ] Screen reader announcements for state changes
- [ ] WCAG 2.2 AA minimum (AAA for touch targets)

### Performance
- [ ] Modal opens in <200ms (realistic target)
- [ ] No jank during swipe-to-dismiss
- [ ] Stagger removal reduces bundle by ~15KB (estimate)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users miss visibility controls | One-time tooltip: "Customize in Settings" |
| Stagger redirect feels like removal | Toast: "Opening Compose for multi-performer options" |
| Swipe-down conflicts with scroll | Only enable when at scroll top |
| Compose handoff fails | Fallback: navigate anyway, show empty Compose |
| Mobile footer too cramped | Test on 320px width (iPhone SE) |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Primary CTA: Compose or Save? | **Save** - most common action for casual viewers |
| Auth for Save | **Prompt sign-in** with clear value proposition |
| Share button behavior | **Opens share sheet** with options: Copy link, Export, More |
| Compose transition | **Instant navigation** with toast feedback |

---

## Files to Create/Modify/Delete

### Create
- `src/lib/shared/coordinators/sequence-handoff.svelte.ts` - Viewer→Compose data contract
- `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` - New footer component

### Modify
- `SequenceDetailsModal.svelte` - Header, footer, remove visibility chips, add swipe dismiss
- `LayeredSequencePreview.svelte` - Sizing fixes
- `compose-module-state.svelte.ts` - Handoff consumption
- `arrange-state.svelte.ts` - Pre-load sequence support

### Archive (Don't Delete Yet)
- `stagger/StaggerModeModal.svelte`
- `stagger/StaggerPreview.svelte`
- `stagger/OffsetControls.svelte`
- (Any other stagger/* files)

---

*Plan Version: 2.0*
*Created: 2026-01-24*
*Validated against: Self-audit (10 categories), UX research (Netflix, Material, Apple), Mobile gesture research (Instagram, TikTok, YouTube), WCAG 2.2*
*Status: READY FOR REVIEW*
