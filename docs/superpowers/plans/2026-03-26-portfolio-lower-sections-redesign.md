# Portfolio Lower Sections Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the lower portfolio sections (bios, credits, videos, social links, about) from database-admin form layouts into display-first cards that match the quality of the workshop showcase cards above.

**Architecture:** Two files change. `BioEditor.svelte` gets a full rewrite: inline editing replaced by clickable preview cards that open a BaseModal for editing, with the "Add Bio" button moved to the parent section header. `WorkshopPortfolioEditor.svelte` gets four changes: credits list becomes a pill/chip flow layout, videos list becomes a thumbnail grid, social links and about sections merge into a single "Profile" card with inline-edit-on-click, and dead CSS classes are removed. No data model changes. Same `savePortfolio` calls.

**Tech Stack:** Svelte 5, CSS custom properties, BaseModal, Font Awesome

**Spec:** docs/superpowers/specs/2026-03-26-portfolio-lower-sections-redesign-design.md

---

### Task 1: Bios Section Redesign (BioEditor.svelte rewrite + modal)

**Files:**
- Rewrite: `src/lib/features/festivals/components/portfolio/BioEditor.svelte`
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte` (add "Add Bio" button to section header)

- [ ] **Step 1: Update the BioEditor component interface**

Remove the internal "Add Bio" button. Accept an `editBioId` bindable prop so the parent can trigger the modal for newly-added bios. Export an `addBio` function via the component's public API is not needed -- instead, the parent handles creation and passes the new bio's ID to `editBioId`.

```typescript
<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import type { BioVersion, TeachingPortfolio } from "../../domain/models/teaching-portfolio";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";

  interface Props {
    editBioId?: string | null;
  }

  let { editBioId = $bindable(null) }: Props = $props();

  const { state: festivalState } = getFestivalContext();

  // Modal state
  let modalOpen = $state(false);
  let editingLabel = $state("");
  let editingText = $state("");
  let editingBioId = $state<string | null>(null);
  let confirmingDelete = $state(false);
```

- [ ] **Step 2: Wire editBioId to open the modal**

When the parent sets `editBioId` (after creating a new bio), the modal opens for that bio automatically.

```typescript
  $effect(() => {
    if (editBioId) {
      const bio = festivalState.portfolio?.bios.find((b) => b.id === editBioId);
      if (bio) {
        openEditModal(bio);
      }
      editBioId = null;
    }
  });

  function openEditModal(bio: BioVersion) {
    editingBioId = bio.id;
    editingLabel = bio.label;
    editingText = bio.text;
    confirmingDelete = false;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    editingBioId = null;
    editingLabel = "";
    editingText = "";
    confirmingDelete = false;
  }

  function saveEdit() {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio || !editingBioId) return;
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: festivalState.portfolio.bios.map((b) =>
        b.id === editingBioId ? { ...b, text: editingText, label: editingLabel } : b
      ),
    };
    festivalState.savePortfolio(uid, updated);
    closeModal();
  }

  function deleteBio() {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio || !editingBioId) return;
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: festivalState.portfolio.bios.filter((b) => b.id !== editingBioId),
    };
    festivalState.savePortfolio(uid, updated);
    closeModal();
  }

  function copyBio() {
    navigator.clipboard.writeText(editingText);
  }
```

- [ ] **Step 3: Replace the bio list with clickable preview cards**

Each bio card shows label as title, 3-line clamped preview, and character count badge. Clicking opens the edit modal. Empty state shows italic placeholder.

```svelte
<div class="bio-editor">
  {#if festivalState.portfolio && festivalState.portfolio.bios.length > 0}
    <div class="bio-cards">
      {#each festivalState.portfolio.bios as bio (bio.id)}
        <div
          class="bio-card"
          role="button"
          tabindex="0"
          aria-label="Edit {bio.label}"
          onclick={() => openEditModal(bio)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openEditModal(bio);
            }
          }}
        >
          <span class="bio-char-badge">{bio.text.length} chars</span>
          <h4 class="bio-card-label">{bio.label}</h4>
          {#if bio.text}
            <p class="bio-preview">{bio.text}</p>
          {:else}
            <p class="bio-preview empty">No text yet. Click to edit.</p>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-bios">No bios yet.</p>
  {/if}
</div>
```

- [ ] **Step 4: Add the BaseModal for editing**

Modal uses size `"fit"`, animation `"pop"`. Header shows bio label with pencil icon. Body has label input + textarea. Footer has Copy (ghost) + Delete (ghost danger-text) on left, Cancel (secondary) + Save (primary) on right. Delete uses confirm state within footer.

```svelte
<BaseModal bind:open={modalOpen} onclose={() => closeModal()} size="fit" animation="pop">
  {#snippet header()}
    <ModalHeader
      title={editingLabel || "Edit Bio"}
      icon="fa-pencil-alt"
      iconColor="var(--theme-accent, #6366f1)"
      onClose={() => closeModal()}
    />
  {/snippet}

  <div class="bio-modal-body" data-animate="3">
    <label class="field-label">
      Label
      <input
        class="field-input"
        type="text"
        bind:value={editingLabel}
        placeholder="e.g. Teaching Bio, Performance Bio"
      />
    </label>
    <label class="field-label">
      Bio Text
      <textarea
        class="field-textarea"
        bind:value={editingText}
        rows={8}
        placeholder="Write your bio..."
      ></textarea>
    </label>
    <div class="bio-modal-char-count">{editingText.length} characters</div>
  </div>

  {#snippet footer()}
    <ModalFooter align="between">
      <div class="modal-left-actions">
        <button class="ghost" onclick={copyBio} type="button" title="Copy bio text">
          <i class="fas fa-copy" aria-hidden="true"></i>
          Copy
        </button>
        {#if confirmingDelete}
          <span class="confirm-delete-label">Delete?</span>
          <button class="ghost danger-text" onclick={deleteBio} type="button">Yes</button>
          <button class="ghost" onclick={() => (confirmingDelete = false)} type="button">No</button>
        {:else}
          <button
            class="ghost danger-text"
            onclick={() => (confirmingDelete = true)}
            type="button"
            title="Delete this bio"
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete
          </button>
        {/if}
      </div>
      <div class="modal-right-actions">
        <button class="secondary" onclick={() => closeModal()} type="button">Cancel</button>
        <button class="primary" onclick={saveEdit} disabled={!editingLabel.trim()} type="button">
          Save
        </button>
      </div>
    </ModalFooter>
  {/snippet}
</BaseModal>
```

- [ ] **Step 5: Replace all CSS in BioEditor**

Remove all existing styles. Add styles for bio cards (from spec), modal body, and reduced motion support.

```css
<style>
  .bio-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bio-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

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

  .bio-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .bio-card-label {
    margin: 0 0 8px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    padding-right: 80px; /* space for badge */
  }

  .bio-preview {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.6;
    margin: 0;
  }

  .bio-preview.empty {
    font-style: italic;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
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

  .no-bios {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.45));
    font-style: italic;
  }

  /* ─── Modal body ──────────────────────────────────────────────────────────── */

  .bio-modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .field-input,
  .field-textarea {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 7px 10px;
    font-family: inherit;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .bio-modal-char-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    text-align: right;
  }

  .modal-left-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .modal-right-actions {
    display: flex;
    gap: 8px;
  }

  .danger-text {
    color: var(--semantic-error, #ef4444) !important;
  }

  .danger-text:hover {
    background: rgba(239, 68, 68, 0.1) !important;
  }

  .confirm-delete-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .bio-card {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 6: Add "Add Bio" button to section header in WorkshopPortfolioEditor.svelte**

In `WorkshopPortfolioEditor.svelte`, modify the bios section to include an "Add Bio" button in the header and pass `editBioId` to BioEditor. Add the `addBio` function and `editBioId` state.

Add to the script section (after the existing portfolio-level state variables):

```typescript
  // ─── Bio management (add triggers modal in BioEditor) ──────────────────────
  let editBioId = $state<string | null>(null);

  function addBio() {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    const newBio: BioVersion = {
      id: crypto.randomUUID(),
      label: "New Bio",
      text: "",
    };
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: [...festivalState.portfolio.bios, newBio],
    };
    festivalState.savePortfolio(uid, updated);
    editBioId = newBio.id;
  }
```

Add `BioVersion` to the existing import from `teaching-portfolio.ts`.

Update the bios section HTML:

```svelte
    <!-- ── Bios section ──────────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Bios</h3>
        <button class="add-btn" onclick={addBio}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Bio
        </button>
      </div>
      <BioEditor bind:editBioId />
    </section>
```

**Build check:**

```bash
cd F:/tka-platform && npm run build 2>&1 | tail -5
```

**Commit:**

```bash
git add src/lib/features/festivals/components/portfolio/BioEditor.svelte src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "$(cat <<'EOF'
feat(portfolio): redesign bios section with preview cards + modal editing

Bio cards show label, 3-line text preview, and character count badge.
Clicking opens a BaseModal for editing. Add Bio button moved to section
header in WorkshopPortfolioEditor.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Performance Credits Pill Layout

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

- [ ] **Step 1: Replace credits HTML with pill flow layout**

Replace the `<ul class="string-list">` block and `<div class="add-row">` for credits with:

```svelte
    <!-- ── Performance credits ───────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Performance Credits</h3>
      </div>

      <div class="credits-flow">
        {#each festivalState.portfolio.performanceCredits as credit, i (i)}
          <div class="credit-pill">
            <span>{credit}</span>
            <button
              class="credit-remove"
              onclick={() => removeCredit(i)}
              aria-label="Remove {credit}"
              tabindex="0"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        {/each}
        <input
          class="credit-add-input"
          type="text"
          bind:value={newCredit}
          placeholder="Add credit..."
          onkeydown={(e) => e.key === "Enter" && addCredit()}
        />
      </div>
    </section>
```

- [ ] **Step 2: Add credits pill CSS**

Add the following CSS from the spec. Include `:focus-within` for keyboard accessibility and mobile permanent visibility for remove buttons.

```css
  /* ─── Performance credits (pill flow) ─────────────────────────────────────── */

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
    font-size: 10px;
    transition: opacity 0.15s, color 0.15s;
  }

  .credit-pill:hover .credit-remove,
  .credit-pill:focus-within .credit-remove {
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

  @media (max-width: 768px) {
    .credit-remove {
      opacity: 1;
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .credit-remove {
      transition: none;
    }
  }
```

**Build check:**

```bash
cd F:/tka-platform && npm run build 2>&1 | tail -5
```

**Commit:**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "$(cat <<'EOF'
feat(portfolio): replace credits list with pill/chip flow layout

Credits display as horizontal-wrap pills with hover-to-reveal remove
buttons. Inline dashed-border input flows with the pills. Mobile shows
remove buttons permanently with 44px touch targets.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Performance Videos Thumbnail Grid

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

- [ ] **Step 1: Add the extractYouTubeId helper function**

Add to the script section of `WorkshopPortfolioEditor.svelte`:

```typescript
  // ─── YouTube thumbnail helper ──────────────────────────────────────────────
  function extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|(?:v|embed|shorts)[=\/])([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
  }

  let failedThumbnails = $state<Set<string>>(new Set());
```

- [ ] **Step 2: Replace videos HTML with thumbnail grid**

Replace the videos `<ul class="string-list">` and `<div class="add-row">` blocks with:

```svelte
    <!-- ── Performance videos ────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Performance Videos</h3>
      </div>

      {#if festivalState.portfolio.performanceVideos.length > 0}
        <div class="video-grid">
          {#each festivalState.portfolio.performanceVideos as video, i (i)}
            {@const videoId = extractYouTubeId(video)}
            <div class="video-card">
              {#if videoId && !failedThumbnails.has(videoId)}
                <img
                  class="video-thumbnail"
                  src="https://img.youtube.com/vi/{videoId}/mqdefault.jpg"
                  alt="Video thumbnail"
                  onerror={() => {
                    failedThumbnails = new Set([...failedThumbnails, videoId]);
                  }}
                />
              {:else}
                <div class="video-thumbnail-placeholder">
                  <i class="fas fa-video" aria-hidden="true"></i>
                </div>
              {/if}
              <div class="video-overlay">
                <button
                  class="video-remove-btn"
                  onclick={() => removeVideo(i)}
                  aria-label="Remove video"
                  tabindex="0"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
              <div class="video-url-label" title={video}>{video}</div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="video-add-row">
        <input
          class="add-input"
          type="url"
          bind:value={newVideo}
          placeholder="Paste YouTube URL..."
          onkeydown={(e) => e.key === "Enter" && addVideo()}
        />
        <button class="add-inline-btn" onclick={addVideo} disabled={!newVideo.trim()}>
          Add
        </button>
      </div>
    </section>
```

- [ ] **Step 3: Add video grid CSS**

Add the full CSS from the spec for `.video-grid`, `.video-card`, `.video-thumbnail`, `.video-thumbnail-placeholder`, `.video-overlay`, `.video-remove-btn`, and `.video-url-label`. Include mobile touch target and reduced motion support.

```css
  /* ─── Performance videos (thumbnail grid) ─────────────────────────────────── */

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

  .video-card:hover .video-overlay,
  .video-card:focus-within .video-overlay {
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
    transition: background 0.15s, border-color 0.15s;
  }

  /* Overlay scrim colors are intentionally hardcoded -- they sit on
     dynamic thumbnail backgrounds, not themed surfaces. */

  .video-remove-btn:hover {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .video-url-label {
    padding: 8px 10px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-add-row {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 768px) {
    .video-overlay {
      opacity: 1;
    }

    .video-remove-btn {
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .video-overlay,
    .video-remove-btn {
      transition: none;
    }
  }
```

**Build check:**

```bash
cd F:/tka-platform && npm run build 2>&1 | tail -5
```

**Commit:**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "$(cat <<'EOF'
feat(portfolio): replace videos list with YouTube thumbnail grid

Each video shows a thumbnail extracted from the YouTube URL. Hover
overlay reveals a remove button. Non-YouTube URLs show a generic
video icon placeholder. Failed thumbnails gracefully fall back.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Profile Card (merged Social Links + About with click-to-edit)

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

- [ ] **Step 1: Add inline edit state**

Add to the script section:

```typescript
  // ─── Inline edit state for Profile card ────────────────────────────────────
  let editingField = $state<string | null>(null);
  let editingFieldOriginal = $state<string | number>("");
```

- [ ] **Step 2: Add inline edit helper functions**

```typescript
  function startFieldEdit(field: string) {
    editingField = field;
    // Capture original value for Escape revert
    switch (field) {
      case "website": editingFieldOriginal = slWebsite; break;
      case "instagram": editingFieldOriginal = slInstagram; break;
      case "facebook": editingFieldOriginal = slFacebook; break;
      case "youtube": editingFieldOriginal = slYoutube; break;
      case "tiktok": editingFieldOriginal = slTiktok; break;
      case "homeCity": editingFieldOriginal = aHomeCity; break;
      case "homeCountry": editingFieldOriginal = aHomeCountry; break;
      case "yearsTeaching": editingFieldOriginal = aYearsTeaching; break;
      case "yearsPerforming": editingFieldOriginal = aYearsPerforming; break;
      case "insuranceProvider": editingFieldOriginal = aInsuranceProvider; break;
    }
  }

  function finishFieldEdit(field: string) {
    editingField = null;
    // Trigger the appropriate save
    if (["website", "instagram", "facebook", "youtube", "tiktok"].includes(field)) {
      handleSocialChange();
    } else {
      handleAboutChange();
    }
  }

  function cancelFieldEdit(field: string) {
    // Revert to original value
    switch (field) {
      case "website": slWebsite = editingFieldOriginal as string; break;
      case "instagram": slInstagram = editingFieldOriginal as string; break;
      case "facebook": slFacebook = editingFieldOriginal as string; break;
      case "youtube": slYoutube = editingFieldOriginal as string; break;
      case "tiktok": slTiktok = editingFieldOriginal as string; break;
      case "homeCity": aHomeCity = editingFieldOriginal as string; break;
      case "homeCountry": aHomeCountry = editingFieldOriginal as string; break;
      case "yearsTeaching": aYearsTeaching = editingFieldOriginal as number; break;
      case "yearsPerforming": aYearsPerforming = editingFieldOriginal as number; break;
      case "insuranceProvider": aInsuranceProvider = editingFieldOriginal as string; break;
    }
    editingField = null;
  }

  function handleFieldKeydown(e: KeyboardEvent, field: string) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      finishFieldEdit(field);
    } else if (e.key === "Escape") {
      cancelFieldEdit(field);
    }
  }
```

- [ ] **Step 3: Replace Social Links and About sections with a single Profile card**

Remove the two separate `<section class="section-card">` blocks for Social Links and About. Replace with:

```svelte
    <!-- ── Profile (social links + about merged) ─────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">
          <i class="fas fa-user" aria-hidden="true" style="margin-right: 6px; opacity: 0.5;"></i>
          Profile
        </h3>
      </div>

      <div class="profile-layout">
        <!-- Social Links column -->
        <div class="profile-column">
          <div class="profile-column-title">Social Links</div>
          {#each [
            { key: "website", icon: "fa-globe", value: slWebsite, placeholder: "yourwebsite.com" },
            { key: "instagram", icon: "fa-instagram", value: slInstagram, placeholder: "@handle" },
            { key: "facebook", icon: "fa-facebook", value: slFacebook, placeholder: "facebook.com/page" },
            { key: "youtube", icon: "fa-youtube", value: slYoutube, placeholder: "youtube.com/@channel" },
            { key: "tiktok", icon: "fa-tiktok", value: slTiktok, placeholder: "@handle" },
          ] as link (link.key)}
            <div
              class="social-row"
              onclick={() => editingField !== link.key && startFieldEdit(link.key)}
            >
              <i
                class="{link.key === 'website' ? 'fas' : 'fab'} {link.icon} social-icon"
                aria-hidden="true"
              ></i>
              {#if editingField === link.key}
                <input
                  class="social-edit-input"
                  type="text"
                  bind:value={
                    link.key === "website" ? slWebsite :
                    link.key === "instagram" ? slInstagram :
                    link.key === "facebook" ? slFacebook :
                    link.key === "youtube" ? slYoutube : slTiktok
                  }
                  placeholder={link.placeholder}
                  onblur={() => finishFieldEdit(link.key)}
                  onkeydown={(e) => handleFieldKeydown(e, link.key)}
                  aria-label={link.key}
                />
              {:else}
                <span class="social-value" class:empty={!link.value}>
                  {link.value || "Not set"}
                </span>
              {/if}
            </div>
          {/each}
        </div>

        <!-- About column -->
        <div class="profile-column">
          <div class="profile-column-title">About</div>
          {#each [
            { key: "homeCity", label: "City", value: aHomeCity, type: "text", placeholder: "Chicago" },
            { key: "homeCountry", label: "Country", value: aHomeCountry, type: "text", placeholder: "USA" },
            { key: "yearsTeaching", label: "Years Teaching", value: aYearsTeaching, type: "number", placeholder: "" },
            { key: "yearsPerforming", label: "Years Performing", value: aYearsPerforming, type: "number", placeholder: "" },
            { key: "insuranceProvider", label: "Insurance", value: aInsuranceProvider, type: "text", placeholder: "e.g. Specialty Insurance" },
          ] as field (field.key)}
            <div
              class="about-row"
              onclick={() => editingField !== field.key && startFieldEdit(field.key)}
            >
              <span class="about-label">{field.label}</span>
              {#if editingField === field.key}
                <input
                  class="social-edit-input"
                  type={field.type}
                  bind:value={
                    field.key === "homeCity" ? aHomeCity :
                    field.key === "homeCountry" ? aHomeCountry :
                    field.key === "yearsTeaching" ? aYearsTeaching :
                    field.key === "yearsPerforming" ? aYearsPerforming : aInsuranceProvider
                  }
                  placeholder={field.placeholder}
                  min={field.type === "number" ? "0" : undefined}
                  onblur={() => finishFieldEdit(field.key)}
                  onkeydown={(e) => handleFieldKeydown(e, field.key)}
                  aria-label={field.label}
                />
              {:else}
                <span
                  class="about-value"
                  class:empty={!field.value && field.value !== 0}
                >
                  {#if field.value || field.value === 0}
                    {field.value}
                  {:else}
                    Not set
                  {/if}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>
```

**Important note on `bind:value` with `{#each}`:** Svelte 5 may not allow `bind:value` to a ternary expression inside `{#each}`. If this causes build errors, the implementer should instead use a helper function pattern: create `getSocialValue`/`setSocialValue` functions that switch on the key, and use `value={getSocialValue(link.key)}` with `oninput={(e) => setSocialValue(link.key, e.target.value)}` instead of `bind:value`. Same pattern for the about column. The auto-focus on the input should be handled via a `use:action` or `$effect` that calls `.focus()` when `editingField` changes.

- [ ] **Step 4: Add Profile card CSS**

```css
  /* ─── Profile card (social + about) ──────────────────────────────────────── */

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

  .social-edit-input:focus {
    outline: none;
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

**Build check:**

```bash
cd F:/tka-platform && npm run build 2>&1 | tail -5
```

**Commit:**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "$(cat <<'EOF'
feat(portfolio): merge social links + about into Profile card

Single section card with two-column layout. Social links show platform
icons with click-to-edit inline inputs. About shows key/value pairs
with click-to-edit. Escape reverts, Enter/blur saves.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Layout Update + Dead CSS Cleanup

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

- [ ] **Step 1: Remove dead CSS classes**

Delete these CSS blocks that are no longer used after Tasks 1-4:

- `.string-list` (replaced by pills and video cards)
- `.string-item` (replaced by pills and video cards)
- `.string-value` and `.string-value.url` (replaced by pills and video cards)
- `.remove-btn` and `.remove-btn:hover` and `.remove-btn i` (replaced by contextual remove patterns)
- `.add-row` (replaced by inline input in pills, video-add-row for videos)
- `.add-input` and `.add-input:focus` (keep only if still used by video add row -- check)
- `.add-inline-btn`, `.add-inline-btn:disabled`, `.add-inline-btn:not(:disabled):hover` (keep only if still used by video add row -- check)
- `.form-grid` (replaced by profile layout)

**Important:** Before deleting `.add-input`, `.add-input:focus`, `.add-inline-btn` etc., verify whether the video add row still uses them. If the video section still uses `.add-input` and `.add-inline-btn`, keep those classes. The `.video-add-row` class may just use the existing `.add-row` styles -- rename if needed.

- [ ] **Step 2: Verify section order in the grid**

The sections should be ordered:
1. Workshops (full width, `grid-column: 1 / -1`)
2. Bios
3. Profile
4. Performance Credits
5. Performance Videos

Reorder the sections in the HTML to match this order if they differ.

**Build check:**

```bash
cd F:/tka-platform && npm run build 2>&1 | tail -5
```

**Commit:**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "$(cat <<'EOF'
refactor(portfolio): remove dead CSS classes and reorder sections

Remove .string-list, .string-item, .string-value, .remove-btn,
.form-grid and related classes replaced by pills, thumbnail grid,
and profile card. Reorder sections to: workshops, bios, profile,
credits, videos.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build Verification

- [ ] **Step 1: Run full build**

```bash
cd F:/tka-platform && npm run build
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd F:/tka-platform && npm run check
```

- [ ] **Step 3: Visual verification**

Tell the user: "Please open the festivals module portfolio editor in your browser and verify: (1) bio cards show preview with char badge, click opens modal, (2) credits display as pills with hover-to-remove, (3) videos show YouTube thumbnails in a grid, (4) social links + about are merged into a Profile card with click-to-edit rows."

No commit for this task -- verification only.
