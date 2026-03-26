# Portfolio Lower Sections Redesign

## Problem

The workshop portfolio editor (`WorkshopPortfolioEditor.svelte`) has a split personality. The top section (workshop cards) was recently redesigned as showcase-first portrait cards. The bottom sections -- bios, performance credits, performance videos, social links, and about -- still look like a database admin panel. Vertical string lists with X buttons, raw URL text, form grids with labeled inputs. It reads as "data entry form" instead of "professional teaching portfolio."

The data model is clean (`TeachingPortfolio` in `teaching-portfolio.ts`). The presentation needs to match the quality of the workshop cards above.

## Design Direction

Shift every section from "edit form" to "display-first card." Content is readable at a glance. Editing happens on interaction (click to open modal, click to reveal controls, inline editing). No action buttons cluttering the card surface. The lower sections should feel like they belong in the same portfolio as the workshop showcase cards.

---

## 1. Bios Section

### Current State

Each bio is a card with the full text visible plus Copy/Edit/Delete buttons on the card surface. Editing happens inline (textarea replaces the card content). The `BioEditor.svelte` component owns all of this, including the "Add Bio" button at the bottom.

### Redesign

**Card layout:** Each bio card shows the label as a title, the first 2-3 lines of text as a preview (truncated with `-webkit-line-clamp: 3`), and a character count badge in the top-right corner. No action buttons on the card surface.

**Click behavior:** Clicking a bio card opens a `BaseModal` (size `"fit"`, animation `"pop"`) for editing. The modal uses `ModalHeader` with the bio label as title and `fa-pencil-alt` icon. Modal body contains the label input and textarea (same fields as current inline edit). `ModalFooter` with `align="between"`: left side has Copy (ghost) and Delete (ghost danger-text), right side has Cancel (secondary) and Save (primary).

**Delete confirmation:** The Delete button in the footer triggers a confirm state within the footer (same pattern as the current `deletingId` approach -- "Delete?" + Yes/No replaces the Delete button).

**Add Bio:** Move the "Add Bio" button into the section header (next to the "Bios" title), using the existing `.add-btn` styling from `WorkshopPortfolioEditor.svelte`. Remove it from `BioEditor.svelte`. When clicked, create the new bio and immediately open the modal for it.

**Character count badge:** Small pill in the top-right of each card. Uses `var(--font-size-compact, 12px)`, `var(--theme-text-secondary)` color, subtle background `var(--theme-card-bg)`. No character limit enforced. Count shows "N chars" format as an informational indicator for festival application length awareness.

**Copy button:** The Copy button in the modal footer copies the full bio text to clipboard via `navigator.clipboard.writeText()`.

### CSS Approach

```css
.bio-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;
}

.bio-card:hover {
  border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
}

.bio-preview {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  line-height: 1.6;
}

.bio-char-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: var(--font-size-compact, 12px);
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  padding: 2px 8px;
  border-radius: 10px;
}
```

### Files

- **Modify `BioEditor.svelte`:** Remove inline editing, remove the add button. Each bio becomes a clickable card. Add a `BaseModal` for editing (import BaseModal, ModalHeader, ModalFooter). Expose an `onadd` event or accept an `onRequestAdd` callback so the parent can wire the "Add Bio" header button.
- **Modify `WorkshopPortfolioEditor.svelte`:** Add "Add Bio" button to the Bios section header (same pattern as Workshop section header). Wire it to `BioEditor`'s add function.

---

## 2. Performance Credits Section

### Current State

Vertical `<ul>` list. Each credit is a `.string-item` row with the text and an X button. Add input + "Add" button below.

### Redesign

**Pill/chip layout:** Credits flow horizontally and wrap. Each credit is a pill -- rounded, compact, inline. Background uses `color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent)` for a subtle tinted background. Text in `var(--theme-text, #ffffff)`.

**Remove on hover:** No visible X button by default. On hover (desktop) or long-press (mobile), a small X icon appears on the right side of the pill. Click X to remove. The pill gets a subtle red border on hover of the X (`var(--semantic-error)`).

**Inline add:** The input flows with the pills as the last item in the flex container. No separate row. Styled as a borderless input with a `+` icon prefix, matching the pill height. Placeholder: "Add credit..." Enter to submit.

### CSS Approach

```css
.credits-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.credit-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
  border-radius: 20px;
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text, #ffffff);
  position: relative;
}

.credit-remove {
  opacity: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  cursor: pointer;
  border-radius: 50%;
  font-size: 10px; /* Font Awesome icon (fa-times) — 10px is within the 10-12px icon floor per styling rules */
  transition: opacity 0.15s, color 0.15s;
}

.credit-pill:hover .credit-remove {
  opacity: 1;
}

.credit-remove:hover {
  color: var(--semantic-error, #ef4444);
}

.credit-add-input {
  background: none;
  border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
  border-radius: 20px;
  padding: 6px 12px;
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text, #ffffff);
  min-width: 140px;
}

.credit-add-input::placeholder {
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
}

.credit-add-input:focus {
  outline: none;
  border-color: var(--theme-accent, #6366f1);
  border-style: solid;
}
```

### Files

- **Modify `WorkshopPortfolioEditor.svelte`:** Replace the `<ul class="string-list">` block for credits with the pill flow layout. Replace the `.add-row` with an inline input inside the flex container. Remove the "Add" button (Enter key submits instead).

---

## 3. Performance Videos Section

### Current State

Same vertical list as credits. Raw YouTube URLs displayed as text with X buttons.

### Redesign

**Thumbnail cards:** Each video is a small card showing the YouTube thumbnail image. Extract the video ID from the URL using a regex (`/(?:youtu\.be\/|(?:v|embed|shorts)[=\/])([a-zA-Z0-9_-]{11})/`) to handle standard, embed, shorts, and /v/ URLs. Display thumbnail via `https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg` (320x180). If the URL doesn't match YouTube format, show a generic video icon placeholder. The `img` element uses an `onerror` handler to swap to the placeholder div on load failure.

**Card layout:** Horizontal scroll or wrap grid (2-3 cards per row depending on available space). Each card is ~160px wide with the thumbnail at top (aspect-ratio 16/9), and a truncated URL below for identification.

**Remove on hover:** Semi-transparent overlay with X icon appears on hover over the thumbnail. Click to remove.

**Add input:** Below the grid, same style as current but with a URL validation hint. Placeholder: "Paste YouTube URL..."

### CSS Approach

```css
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.video-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  position: relative;
}

.video-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}

.video-thumbnail-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
  font-size: 24px;
}

.video-overlay {
  position: absolute;
  inset: 0;
  bottom: auto;
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.video-card:hover .video-overlay {
  opacity: 1;
}

.video-remove-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.video-remove-btn:hover {
  background: var(--semantic-error, #ef4444);
  border-color: var(--semantic-error, #ef4444);
}

/* Overlay scrim colors (video-overlay, video-remove-btn) are intentionally
   hardcoded as they sit on dynamic thumbnail backgrounds, not themed surfaces. */

.video-url-label {
  padding: 8px 10px;
  font-size: var(--font-size-compact, 12px);
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Helper Function

Add a `extractYouTubeId` function within the component script:

```typescript
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|(?:v|embed|shorts)[=\/])([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}
```

### Files

- **Modify `WorkshopPortfolioEditor.svelte`:** Replace the videos `<ul class="string-list">` with a `.video-grid`. Each item becomes a `.video-card` with thumbnail, overlay, and URL label. Keep the add input row below the grid.

---

## 4. Profile Card (Social Links + About merged)

### Current State

Two separate `.section-card` sections: "Social Links" with 5 form inputs (website, instagram, facebook, youtube, tiktok) and "About" with 5 form inputs (home city, country, years teaching, years performing, insurance). All displayed as always-editable form grids.

### Redesign

**Single "Profile" section card.** Two-column layout on desktop, stacking on mobile.

**Left column -- Social Links:** Each link is a row with a platform icon (Font Awesome brand icons: `fa-globe` for website, `fa-instagram`, `fa-facebook`, `fa-youtube`, `fa-tiktok`) followed by the current value. Display mode by default -- shows the value as text. If empty, shows dimmed placeholder text ("Not set"). Clicking a row switches it to inline edit mode (input replaces text, auto-focused, blur or Enter saves). Same debounced auto-save as current implementation.

**Right column -- About Info:** Compact key/value pairs. Each pair is a row: label on the left (`var(--theme-text-secondary)`), value on the right (`var(--theme-text)`). Clicking a value switches to inline edit mode. Fields: City (`homeCity`), Country (`homeCountry`), Years Teaching, Years Performing, Insurance Provider.

**Insurance note:** `policyExpiration` is not displayed in this redesign. Only the provider name is shown. Expiration tracking can be added later if needed.

**Section title:** "Profile" with a `fa-user` icon in the section header.

### CSS Approach

```css
.profile-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 600px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}

.profile-column-title {
  font-size: var(--font-size-compact, 12px);
  font-weight: 600;
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.social-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  cursor: pointer;
}

.social-row:last-child {
  border-bottom: none;
}

.social-icon {
  width: 20px;
  text-align: center;
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  font-size: var(--font-size-sm, 14px);
  flex-shrink: 0;
}

.social-value {
  flex: 1;
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text, #ffffff);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.social-value.empty {
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
  font-style: italic;
}

.social-edit-input {
  flex: 1;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  border: 1px solid var(--theme-accent, #6366f1);
  border-radius: 5px;
  color: var(--theme-text, #ffffff);
  font-size: var(--font-size-sm, 14px);
  padding: 4px 8px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  cursor: pointer;
}

.about-row:last-child {
  border-bottom: none;
}

.about-label {
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
}

.about-value {
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text, #ffffff);
  font-weight: 500;
}

.about-value.empty {
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
  font-style: italic;
  font-weight: 400;
}
```

### Inline Edit State

Track which field is being edited with a `editingField` state variable (`$state<string | null>(null)`). On click, set `editingField` to the field key (e.g., `"instagram"`, `"homeCity"`). Render an input instead of the text span. On blur or Enter, clear `editingField` and trigger the debounced save.

**Keyboard behavior:**
- **Escape** discards changes and reverts to the pre-edit value.
- **Tab** saves the current field and exits edit mode (does NOT chain to the next field).

**Input types:**
- Numeric fields (`yearsTeaching`, `yearsPerforming`) use `type="number"` inputs.
- All other fields use `type="text"`.

**Location fields:** `homeCity` and `homeCountry` are displayed as TWO separate rows in the About column, labeled "City" and "Country" respectively. They are not combined into a single "City, Country" display.

### Files

- **Modify `WorkshopPortfolioEditor.svelte`:** Remove the separate "Social Links" and "About" section cards. Replace with a single "Profile" section card containing the two-column layout. Keep the existing `$state` fields and debounce logic -- just change the rendering from form grids to display-first rows with inline editing.

---

## 5. Overall Layout

### Grid Changes

The existing `.portfolio-grid` uses `auto-fill, minmax(min(400px, 100%), 1fr)`. Keep this for the lower sections. The workshops section already spans full width (`grid-column: 1 / -1`).

New section ordering in the grid:
1. **Workshops** (full width, already done)
2. **Bios** (takes one column)
3. **Profile** (takes one column, merges social + about)
4. **Performance Credits** (takes one column)
5. **Performance Videos** (takes one column)

This gives a natural 2x2 grid on desktop below the full-width workshops row.

### Removed CSS

Delete these classes from `WorkshopPortfolioEditor.svelte` after the redesign:
- `.string-list`, `.string-item`, `.string-value` (replaced by pills and video cards)
- `.remove-btn` (replaced by contextual remove patterns)
- `.add-row`, `.add-input`, `.add-inline-btn` (replaced by inline inputs)
- `.form-grid` (replaced by profile layout)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte` | Replace credits list with pill flow. Replace videos list with thumbnail grid. Merge social + about into Profile card. Add "Add Bio" button to bios section header. Add `extractYouTubeId` helper. Remove dead CSS classes. Add new CSS for pills, video grid, profile layout. |
| `src/lib/features/festivals/components/portfolio/BioEditor.svelte` | Convert from inline edit to clickable cards + BaseModal for editing. Remove the "Add Bio" button (moved to parent). Import BaseModal, ModalHeader, ModalFooter. Add bio card preview layout. Add modal with label input, textarea, char count, and footer actions (copy, delete, cancel, save). |

## Files NOT Modified

| File | Reason |
|------|--------|
| `teaching-portfolio.ts` | Data model is fine. No schema changes needed. |
| `WorkshopTemplateCard.svelte` | Already redesigned. Not part of this work. |
| `BaseModal.svelte` / `ModalHeader.svelte` / `ModalFooter.svelte` | Used as-is. No changes to the modal system. |
| `festival-context.ts` / festival state | No state model changes. Same `savePortfolio` calls. |

## Empty States

- **Bios empty:** Show italic "No bios yet" text in the card area. The Add Bio button in the section header remains visible so users can add their first bio.
- **Credits empty:** Show just the add input pill with placeholder "Add a credit..." No other text or prompts.
- **Videos empty:** Show just the add input row with placeholder "Paste YouTube URL..." No other text or prompts.
- **All social links empty:** The "Not set" italic display per row is intentional. No additional empty state needed since each row self-describes its empty status.

---

## Accessibility Considerations

- **Bio cards:** Add `role="button"` and `tabindex="0"` so they're keyboard-navigable. Handle Enter/Space to open the modal. Add `aria-label="Edit {bio.label}"`.
- **Credit pills:** The hidden-by-default remove button must be reachable by keyboard. Use `tabindex="0"` on the remove button so it's focusable even when visually hidden. Show it on `:focus-within` of the pill, not just `:hover`.
- **Video overlay:** Same pattern as pills. The remove button must be focusable and visible on `:focus-within`. Add `aria-label="Remove video"`.
- **Inline edit fields (Profile):** When clicking a row to edit, auto-focus the input. On Escape, cancel the edit and return focus to the row. `aria-label` on each input matching the field name.
- **Reduced motion:** All `transition` properties should respect `prefers-reduced-motion: reduce` by setting `transition: none` in a media query.
- **Touch targets:** All interactive elements (pills, remove buttons, video cards) must meet 44px minimum touch target on mobile. On mobile (< 768px), show the X buttons permanently since hover doesn't exist. For credit pills, the X button itself expands to 44px min touch target via padding. Clicking the pill body does NOT trigger removal -- only the X button removes.
