# Discover Tab: Inline Modal to BaseModal Migration

## Problem

The festivals Discover tab has two inline div-based modals that bypass the shared BaseModal system:

1. **FestivalDetailView** uses a manual `.backdrop` + `.modal` div pattern with hand-rolled Escape handling, backdrop click detection, and close button styling.
2. **FestivalSubmissionForm** uses a `.modal-backdrop` + `.modal-content` div pattern with custom `@keyframes fade-in` and `@keyframes slide-up` animations.

Both miss what BaseModal provides for free:
- Native `<dialog>` element with proper focus trapping and screen reader support
- Modal stack management (nested modals, correct Escape key routing)
- Focus restore on close (returns focus to the element that triggered the modal)
- Consistent `@starting-style` entry/exit animations with spring easing
- `::backdrop` pseudo-element with blur
- `prefers-reduced-motion` handling baked in
- Staggered content animations via `data-animate` attributes

Migrating both modals brings the Discover tab in line with the rest of the app (WorkshopPortfolioEditor, module grid, help modals) and removes ~180 lines of redundant backdrop/modal CSS.

---

## Migration 1: FestivalDetailView

### Current markup structure

```svelte
<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="dialog" aria-modal="true" aria-label={festival.name}
     onclick={handleBackdropClick} onkeydown={handleKeydown} tabindex="-1">
  <div class="modal" class:expanded={showTracker}>
    <button class="close-btn" onclick={onclose}>...</button>
    <div class="main-col">
      <div class="hero">...</div>
      <div class="modal-content">...</div>
    </div>
    {#if showTracker}
      <div class="tracker-side">...</div>
    {/if}
  </div>
</div>
```

### Target markup structure

```svelte
<BaseModal
  open={true}
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
      <div class="hero" style="--fallback-bg: ...">
        <!-- hero image content unchanged -->
      </div>
      <div class="detail-content" data-animate="3">
        <!-- title-bar, info-row, description, bottom-row unchanged -->
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
```

### Props interface change

The parent currently controls visibility by conditionally rendering `<FestivalDetailView>`. Two options:

**Option A (preferred):** Parent passes `open` boolean. FestivalDetailView always exists but BaseModal controls visibility. This is cleaner for animations since BaseModal handles exit transitions before unmounting.

```svelte
<!-- Parent: DiscoverTab.svelte -->
<FestivalDetailView
  open={!!selectedFestival}
  festival={selectedFestival}
  tracker={selectedTracker}
  onclose={() => (selectedFestival = null)}
/>
```

```ts
// FestivalDetailView Props
interface Props {
  open: boolean;
  festival: Festival | null;
  tracker: UserFestivalTracker | undefined;
  onclose: () => void;
}
```

**Option B:** Keep the current conditional render pattern. FestivalDetailView renders BaseModal with `open={true}` and the parent destroys it. Exit animation still works because BaseModal delays unmount internally.

Go with Option A for proper exit animations.

### Size rationale

Use `size="xl"` (maps to `min(90vw, 1400px)` width). The current modal is 800px default, expanding to 1140px with the tracker panel. XL accommodates both states. The `detail-layout` div uses flexbox internally to manage the main-col / tracker-side split, same as today.

### CSS to remove

These classes are fully replaced by BaseModal/ModalHeader:

| Class | Reason |
|-------|--------|
| `.backdrop` | BaseModal's native `::backdrop` replaces this |
| `.modal` | The `<dialog>` element replaces this |
| `.close-btn` (+ `:hover`, `:focus-visible`) | ModalHeader provides the close button |
| `.region-badge` | Moves to ModalHeader subtitle instead |
| `@media (prefers-reduced-motion)` for `.close-btn` | ModalHeader handles this |

Also remove:
- The `<svelte:window onkeydown={handleKeydown} />` binding (BaseModal handles Escape via native dialog cancel event)
- The `handleBackdropClick` function
- The `handleKeydown` function

### CSS to keep

All content-layout CSS stays (scoped to the component):

| Class | Why |
|-------|-----|
| `.detail-layout` (renamed from `.modal`) | Flex row container for main-col + tracker-side |
| `.main-col` | Column layout for hero + content |
| `.hero`, `.hero-img`, `.fallback-text` | Hero image with gradient fallback |
| `.detail-content` (renamed from `.modal-content`) | Scrollable content area |
| `.title-bar`, `.festival-title`, `.title-actions` | Title row with badges |
| `.size-badge`, `.attendance-badge` | Metadata badges |
| `.app-toggle` | Tracker panel toggle button |
| `.info-row`, `.info-chip`, `.info-chip.deadline` | Info chips row |
| `.description` | Description paragraph |
| `.bottom-row`, `.tags`, `.tag` | Tags and action links |
| `.apply-btn`, `.link-btn` | External link buttons |
| `.tracker-side`, `.tracker-heading` | Side panel for tracker |
| Mobile `@media (max-width: 600px)` rules | Content-specific responsive adjustments |

Rename `.modal-content` to `.detail-content` to avoid confusion with BaseModal's internal `.modal-content-wrapper`.

### Behavior to preserve

- **Tracker panel expansion**: `showTracker` stays as internal `$state`. The `.detail-layout` div uses `class:expanded={showTracker}` to widen. Since the `<dialog>` is `size="xl"` (max 1400px), there's room for both states.
- **Hero image loading**: `imageLoaded` / `imageError` state and the fallback gradient stay unchanged.
- **External links**: Apply, Website, Contact links stay in the body content.
- **Attendance count**: Still derived from festival context.

---

## Migration 2: FestivalSubmissionForm

### Current markup structure

```svelte
<div class="modal-backdrop" role="dialog" aria-modal="true"
     aria-labelledby="submit-festival-title" tabindex="-1"
     onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="modal-content">
    {#if submitSuccess}
      <div class="success-state">...</div>
    {:else}
      <header class="modal-header">
        <h2 id="submit-festival-title">Submit a festival</h2>
        <button class="close-btn">...</button>
      </header>
      <div class="modal-body">
        <form>...</form>
      </div>
    {/if}
  </div>
</div>
```

### Target markup structure

```svelte
<BaseModal
  open={true}
  onclose={() => onclose()}
  size="md"
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
      <button type="button" class="btn-primary" onclick={onclose}>Done</button>
    </div>
  {:else}
    <div class="form-body" data-animate="3">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <!-- All form fields unchanged -->
        <!-- Remove .form-actions from here -->
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

### Props interface change

Same approach as FestivalDetailView. Parent passes `open` boolean:

```svelte
<!-- Parent -->
<FestivalSubmissionForm
  open={showSubmitForm}
  onclose={() => (showSubmitForm = false)}
/>
```

```ts
interface Props {
  open: boolean;
  onclose: () => void;
}
```

### Size rationale

Use `size="md"` (480px). The current modal uses `max-width: 560px`. BaseModal's md is 480px, which is close. If the form feels cramped at 480px, override with a CSS custom property or use `size="fit"` which defaults to 480px but grows with content height. Test both during implementation.

### Footer migration

The current `.form-actions` div with Cancel + Submit buttons moves into a `ModalFooter` snippet. This gives consistent button styling (44px min-height, proper focus rings, scale-on-active) and a border separator from the form content. The submit button changes from `type="submit"` inside the form to `onclick={handleSubmit}` in the footer, since ModalFooter lives outside the `<form>` element.

### CSS to remove

| Class | Reason |
|-------|--------|
| `.modal-backdrop` | BaseModal's native `::backdrop` |
| `.modal-content` (the outer wrapper) | `<dialog>` element |
| `.modal-header`, `.modal-header h2` | ModalHeader component |
| `.close-btn` (+ `:hover`) | ModalHeader's close button |
| `.form-actions` | ModalFooter component |
| `.btn-secondary`, `.btn-primary` (+ `:hover`, `:disabled`) | ModalFooter's built-in button styles (`.primary`, `.secondary`) |
| `@keyframes fade-in` | BaseModal's `@starting-style` entry |
| `@keyframes slide-up` | BaseModal's pop animation |
| `@media (prefers-reduced-motion)` for `.modal-backdrop`, `.modal-content` | BaseModal handles this |

Also remove:
- The `handleBackdropClick` function
- The `handleKeydown` function
- The `<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->` comment (native dialog doesn't need it)

### CSS to keep

| Class | Why |
|-------|-----|
| `.form-body` (renamed from `.modal-body`) | Form padding container |
| `form`, `.field`, `.field-row` | Form layout |
| `label`, `.required`, `.optional` | Label styling |
| `input[type="text"]`, `input[type="url"]`, `input[type="date"]`, `textarea` | Form input styles |
| `input::placeholder`, `textarea::placeholder` | Placeholder colors |
| `input:focus`, `textarea:focus`, `input.error` | Focus/error states |
| `.field-error` | Validation error text |
| `.toggles-row`, `.toggle-btn` (+ `:hover`, `.active`) | Seeking toggles |
| `.submit-error` | Error alert box |
| `.success-state`, `.success-icon`, `.success-state h2`, `.success-state p` | Success view |

Rename `.modal-body` to `.form-body` to avoid collision with BaseModal's internal class.

### Behavior to preserve

- **Form validation**: `validate()` function and `validationErrors` state unchanged.
- **Submit flow**: `handleSubmit()` with loading state, geocoding, error handling all unchanged.
- **Success state**: Conditional rendering switches from form to success view. ModalHeader and ModalFooter hide when `submitSuccess` is true. The success view shows inside the modal body.
- **Seeking toggles**: Button-based toggle pattern (no checkboxes) stays.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/features/festivals/components/discover/FestivalDetailView.svelte` | Replace div-based modal with BaseModal + ModalHeader. Remove backdrop/modal CSS. Rename internal classes. |
| `src/lib/features/festivals/components/submit/FestivalSubmissionForm.svelte` | Replace div-based modal with BaseModal + ModalHeader + ModalFooter. Remove backdrop/modal/animation CSS. Move footer buttons to ModalFooter snippet. |
| Parent of FestivalDetailView (likely `DiscoverTab.svelte` or similar) | Change from conditional render to `open` prop pattern for exit animation support. |
| Parent of FestivalSubmissionForm (likely `DiscoverTab.svelte` or similar) | Same `open` prop pattern change. |

No changes needed to BaseModal, ModalHeader, ModalFooter, or modal-tokens.css.

---

## Accessibility Improvements

| Before | After |
|--------|-------|
| `<div role="dialog">` with manual `aria-modal` | Native `<dialog>` element with built-in modal semantics |
| Manual `<svelte:window onkeydown>` for Escape | Native dialog cancel event, respects modal stack |
| No focus trapping (user can tab to background elements) | Native dialog focus trapping |
| No focus restore on close | FocusRestore helper returns focus to trigger element |
| Manual backdrop click detection (`e.target === e.currentTarget`) | BaseModal's content wrapper click barrier pattern |
| Custom reduced-motion handling per modal | Centralized in modal-tokens.css |
| FestivalDetailView: `aria-label` only | `aria-labelledby` pointing to ModalHeader's title `id` |
