# Discover Modal Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hand-rolled div-based modals in the festivals Discover tab (FestivalDetailView and FestivalSubmissionForm) with the shared BaseModal system for native `<dialog>` semantics, focus trapping, modal stacking, and consistent animations.

**Architecture:** Both modals switch from `<div class="backdrop">` + manual Escape/backdrop handlers to `<BaseModal>` with `{#snippet header()}` / `{#snippet footer()}` slots wrapping `<ModalHeader>` and `<ModalFooter>`. Parent components change from conditional rendering (`{#if selected}`) to always-rendering with an `open` boolean prop, so BaseModal can run exit animations before unmounting.

**Tech Stack:** Svelte 5, BaseModal, CSS custom properties

**Spec:** docs/superpowers/specs/2026-03-26-discover-modal-migration-design.md

---

## Task 1: Migrate FestivalDetailView to BaseModal

**Files:**
- Modify: `src/lib/features/festivals/components/discover/FestivalDetailView.svelte`

### Steps

- [ ] **Step 1: Update imports and Props interface**

Add BaseModal and ModalHeader imports. Change Props to accept `open` and make `festival` nullable:

```typescript
// ADD imports
import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";

// CHANGE Props
interface Props {
  open: boolean;
  festival: Festival | null;
  tracker: UserFestivalTracker | undefined;
  onclose: () => void;
}
let { open, festival, tracker, onclose }: Props = $props();
```

- [ ] **Step 2: Remove manual modal infrastructure from script**

Delete these items from the `<script>` block:
- The `handleBackdropClick` function
- The `handleKeydown` function

BaseModal handles Escape via native dialog cancel event and backdrop clicks via its content wrapper click barrier.

- [ ] **Step 3: Replace markup with BaseModal + ModalHeader**

Remove:
```svelte
<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="dialog" aria-modal="true" ...>
  <div class="modal" class:expanded={showTracker}>
    <button class="close-btn" onclick={onclose} aria-label="Close">...</button>
```

Replace with:
```svelte
{#if festival}
<BaseModal
  {open}
  onclose={() => onclose()}
  size="xl"
  animation="pop"
  labelledBy="festival-detail-title"
>
  {#snippet header()}
    <ModalHeader
      title={festival.name}
      subtitle={regionLabels[festival.region] ?? festival.region}
      icon="fa-calendar-star"
      iconColor="hsl({nameHue}, 60%, 45%)"
      onClose={() => onclose()}
      id="festival-detail-title"
    />
  {/snippet}

  <div class="detail-layout" class:expanded={showTracker}>
    <div class="main-col">
      <div class="hero" style="--fallback-bg: linear-gradient(135deg, hsl({nameHue}, 60%, 25%), hsl({nameHue}, 60%, 15%))">
        <!-- hero image content unchanged -->
        <!-- REMOVE the <span class="region-badge"> element (region moves to ModalHeader subtitle) -->
      </div>
      <div class="detail-content" data-animate="3">
        <!-- title-bar, info-row, description, bottom-row all unchanged -->
      </div>
    </div>
    {#if showTracker}
      <div class="tracker-side" data-animate="4">
        <h3 class="tracker-heading">My Application</h3>
        <TrackerControls {festival} {tracker} />
      </div>
    {/if}
  </div>
</BaseModal>
{/if}
```

Key changes:
- Region badge removed from hero overlay, now displayed as ModalHeader `subtitle`
- `.modal` renamed to `.detail-layout`
- `.modal-content` renamed to `.detail-content`
- `data-animate` attributes added for staggered entrance

- [ ] **Step 4: Update CSS -- remove replaced classes**

Delete these CSS blocks entirely:
- `.backdrop` (replaced by BaseModal's native `::backdrop`)
- `.modal` and `.modal.expanded` (replaced by `.detail-layout` and `.detail-layout.expanded`)
- `.close-btn`, `.close-btn:hover`, `.close-btn:focus-visible` (ModalHeader provides close button)
- `.region-badge` (region info moved to ModalHeader subtitle)
- The `@media (prefers-reduced-motion: reduce)` block that references `.close-btn`

- [ ] **Step 5: Update CSS -- rename and adjust kept classes**

Rename `.modal` layout properties to `.detail-layout`:

```css
/* BEFORE */
.modal {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  transition: max-width 0.25s ease;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

/* AFTER */
.detail-layout {
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 0;
}

.detail-layout.expanded {
  /* No max-width override needed -- BaseModal xl handles it */
}
```

Remove positioning, background, border, border-radius, box-shadow, and max-height from `.detail-layout` since `<dialog>` provides those. Keep `display: flex; flex-direction: row;` for the two-column layout.

Rename `.modal-content` to `.detail-content`:

```css
/* BEFORE: .modal-content { ... } */
/* AFTER */
.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15)) transparent;
}
```

Also rename scrollbar pseudo-element selectors from `.modal-content` to `.detail-content`.

Update the mobile media query: change `.modal-content` reference to `.detail-content`, remove `.backdrop { padding }` rule.

- [ ] **Step 6: Add reduced-motion for kept transition elements**

After removing the old blanket `prefers-reduced-motion` block, add a scoped one for elements that still have CSS transitions:

```css
@media (prefers-reduced-motion: reduce) {
  .hero-img,
  .apply-btn,
  .link-btn,
  .app-toggle,
  .detail-layout {
    transition: none;
  }
}
```

- [ ] **Step 7: Run build check**

```bash
npm run build
```

---

## Task 2: Update FestivalModule.svelte parent to use open prop binding

**Files:**
- Modify: `src/lib/features/festivals/FestivalModule.svelte`

### Steps

- [ ] **Step 1: Change from conditional render to open prop pattern**

```svelte
<!-- BEFORE -->
{#if festivalState.selectedFestival}
  <FestivalDetailView
    festival={festivalState.selectedFestival}
    tracker={festivalState.trackers.get(festivalState.selectedFestival.id)}
    onclose={() => (festivalState.selectedFestival = null)}
  />
{/if}

<!-- AFTER -->
<FestivalDetailView
  open={!!festivalState.selectedFestival}
  festival={festivalState.selectedFestival}
  tracker={festivalState.selectedFestival
    ? festivalState.trackers.get(festivalState.selectedFestival.id)
    : undefined}
  onclose={() => (festivalState.selectedFestival = null)}
/>
```

The component is always mounted. BaseModal controls visibility and handles exit animations before the `open` prop flips to `false`.

- [ ] **Step 2: Run build check**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/festivals/components/discover/FestivalDetailView.svelte src/lib/features/festivals/FestivalModule.svelte
git commit -m "$(cat <<'EOF'
refactor(festivals): migrate FestivalDetailView to BaseModal

Replace hand-rolled div backdrop + modal pattern with native <dialog>
via BaseModal. Region badge moves to ModalHeader subtitle. Manual
Escape/backdrop handlers removed in favor of native dialog events.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate FestivalSubmissionForm to BaseModal

**Files:**
- Modify: `src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte`
- Modify: `src/lib/features/festivals/components/discover/DiscoverTab.svelte`

### Steps

- [ ] **Step 1: Update imports and Props interface**

```typescript
// ADD imports
import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";

// CHANGE Props
interface Props {
  open: boolean;
  onclose: () => void;
}
const { open, onclose }: Props = $props();
```

- [ ] **Step 2: Remove manual modal infrastructure from script**

Delete:
- `handleBackdropClick` function
- `handleKeydown` function

- [ ] **Step 3: Handle Enter-to-submit regression**

Since the submit button moves to ModalFooter (outside `<form>`), Enter key in form fields won't auto-submit. Add an `onkeydown` handler on the `<form>` element:

```svelte
<form onsubmit={(e) => e.preventDefault()} onkeydown={(e) => {
  if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
    e.preventDefault();
    handleSubmit();
  }
}}>
```

This preserves Enter-to-submit for text/url/date inputs but not for `<textarea>` (where Enter should add a newline). The explicit `onsubmit` preventDefault stays as a safety net.

- [ ] **Step 4: Replace markup with BaseModal + ModalHeader + ModalFooter**

Remove the entire `<div class="modal-backdrop">...</div>` block and the `<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->` comment.

Replace with:

```svelte
<BaseModal
  {open}
  onclose={() => onclose()}
  size="fit"
  animation="pop"
  labelledBy="submit-festival-title"
>
  {#snippet header()}
    {#if !submitSuccess}
      <ModalHeader
        title="Submit a festival"
        icon="fa-paper-plane"
        iconColor="#22c55e"
        onClose={() => onclose()}
        id="submit-festival-title"
      />
    {/if}
  {/snippet}

  {#if submitSuccess}
    <div class="success-state" data-animate="2">
      <div class="success-icon">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
      </div>
      <h2>Festival submitted</h2>
      <p>Thanks. We'll review it and add it to the directory soon.</p>
      <button type="button" class="done-btn" onclick={onclose}>Done</button>
    </div>
  {:else}
    <div class="form-body" data-animate="3">
      <form onsubmit={(e) => e.preventDefault()} onkeydown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <!-- All form fields from Name through Seeking toggles UNCHANGED -->
        <!-- submit-error div stays inside the form -->
        <!-- REMOVE the .form-actions div (buttons move to ModalFooter) -->
      </form>
    </div>
  {/if}

  {#snippet footer()}
    {#if !submitSuccess}
      <ModalFooter align="end">
        <button class="secondary" onclick={onclose} disabled={isSubmitting}>
          Cancel
        </button>
        <button class="primary" onclick={handleSubmit} disabled={isSubmitting}>
          {#if isSubmitting}
            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            Submitting...
          {:else}
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
            Submit festival
          {/if}
        </button>
      </ModalFooter>
    {/if}
  {/snippet}
</BaseModal>
```

Key changes:
- `size="fit"` so the modal grows with form content (spec says test `md` vs `fit`, prefer `fit` for form modals)
- Header and footer hidden when `submitSuccess` is true
- Submit button uses `onclick={handleSubmit}` instead of `type="submit"` since it's outside the form
- ModalFooter `.secondary` and `.primary` button classes get styling from ModalFooter's `:global(button.secondary)` and `:global(button.primary)` rules

- [ ] **Step 5: Update CSS -- remove replaced classes**

Delete these CSS blocks entirely:
- `.modal-backdrop` (BaseModal's `::backdrop`)
- `@keyframes fade-in` (BaseModal's `@starting-style`)
- `.modal-content` (outer wrapper, replaced by `<dialog>`)
- `@keyframes slide-up` (BaseModal's pop animation)
- `.modal-header`, `.modal-header h2` (ModalHeader)
- `.close-btn`, `.close-btn:hover` (ModalHeader's close button)
- `.form-actions` (ModalFooter)
- `.btn-secondary`, `.btn-primary` shared base styles (ModalFooter button styles)
- `.btn-secondary:hover:not(:disabled)`, `.btn-primary:hover:not(:disabled)` (ModalFooter hover)
- `.btn-secondary:disabled`, `.btn-primary:disabled` (ModalFooter disabled)
- The `@media (prefers-reduced-motion: reduce)` block referencing `.modal-backdrop`, `.modal-content`

- [ ] **Step 6: Update CSS -- rename kept classes and add done-btn**

Rename `.modal-body` to `.form-body`:

```css
/* BEFORE: .modal-body { padding: 20px; } */
/* AFTER */
.form-body {
  padding: 20px;
}
```

Rename `.btn-primary` (used in success state Done button) to `.done-btn`:

```css
.done-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-min, 14px);
  font-weight: 500;
  cursor: pointer;
  min-height: 40px;
  background: var(--theme-accent, #3b82f6);
  border: none;
  color: #ffffff;
  transition: background 0.15s ease;
}

.done-btn:hover {
  background: var(--theme-accent-hover, #2563eb);
}
```

- [ ] **Step 7: Add reduced-motion for kept transition elements**

```css
@media (prefers-reduced-motion: reduce) {
  .toggle-btn,
  .done-btn,
  input,
  textarea {
    transition: none;
  }
}
```

- [ ] **Step 8: Update DiscoverTab.svelte parent**

Change from conditional render to open prop:

```svelte
<!-- BEFORE -->
{#if showSubmitForm}
  <FestivalSubmissionForm onclose={() => (showSubmitForm = false)} />
{/if}

<!-- AFTER -->
<FestivalSubmissionForm
  open={showSubmitForm}
  onclose={() => (showSubmitForm = false)}
/>
```

- [ ] **Step 9: Run build check**

```bash
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte src/lib/features/festivals/components/discover/DiscoverTab.svelte
git commit -m "$(cat <<'EOF'
refactor(festivals): migrate FestivalSubmissionForm to BaseModal

Replace div-based modal with native <dialog> via BaseModal + ModalHeader
+ ModalFooter. Footer buttons moved to ModalFooter snippet. Added
Enter-to-submit handler on form to prevent regression from submit
button moving outside the <form> element.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build Verification

**Files:** None (verification only)

### Steps

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: TypeScript check**

```bash
npm run check
```

- [ ] **Step 3: Manual verification checklist**

Tell the user to verify the following in their running dev server:

1. **FestivalDetailView**: Click a festival card in Discover tab. Modal opens with ModalHeader showing festival name + region subtitle. Hero image displays without region badge overlay. Tracker side panel still toggles. Escape closes modal. Clicking backdrop closes modal. Focus returns to the card that was clicked.

2. **FestivalSubmissionForm**: Click "Submit a Festival" button. Modal opens with ModalHeader and form. Cancel/Submit buttons in footer. Fill required fields and press Enter in a text input -- form submits. Press Enter in the description textarea -- newline inserted (not submitted). Submit succeeds and shows success state (header/footer hidden, "Done" button visible). Escape closes modal.

3. **Reduced motion**: Enable `prefers-reduced-motion: reduce` in DevTools. Both modals open/close without animations.

---

## Summary of all files modified

| File | Change |
|------|--------|
| `src/lib/features/festivals/components/discover/FestivalDetailView.svelte` | Replace div modal with BaseModal + ModalHeader. Remove ~60 lines of backdrop/modal/close-btn CSS. Rename `.modal` to `.detail-layout`, `.modal-content` to `.detail-content`. |
| `src/lib/features/festivals/FestivalModule.svelte` | Change from conditional render to always-mounted with `open` prop. |
| `src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte` | Replace div modal with BaseModal + ModalHeader + ModalFooter. Remove ~100 lines of backdrop/animation/header/footer CSS. Add Enter-to-submit handler. Rename `.modal-body` to `.form-body`, `.btn-primary` to `.done-btn`. |
| `src/lib/features/festivals/components/discover/DiscoverTab.svelte` | Change from conditional render to always-mounted with `open` prop. |

**Estimated net CSS removal:** ~160 lines across both modals.

**No changes needed to:** BaseModal.svelte, ModalHeader.svelte, ModalFooter.svelte, modal-tokens.css.
