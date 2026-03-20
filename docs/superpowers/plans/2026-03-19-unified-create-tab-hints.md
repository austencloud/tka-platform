# Unified Create Tab Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize instruction hint placement (always top) and styling across all four Create module tabs.

**Architecture:** Each tab keeps its own hint markup (no shared component — follows Svelte scoping philosophy). All hints use the same `.workspace-hint` CSS class for consistent font size, weight, color, and padding. Redundant hints are removed.

**Tech Stack:** Svelte 5, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-19-unified-create-tab-hints-design.md`

---

### Task 1: Move Generate hint from center to top

**Files:**
- Modify: `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte:173-186` (template)
- Modify: `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte:388-400` (styles)

- [ ] **Step 1: Update the template — move hint above workspace content, change element**

Replace this block (lines 173-186):
```svelte
    <div class="workspace-content">
      {#if hasWorkspaceContent}
        <CreationWorkspaceArea
          {animatingStepNumber}
          {currentDisplayWord}
          {buttonPanelHeight}
          letterSources={currentLetterSources}
          {...toolPanelRef?.getAnimationStateRef?.()
            ? { animationStateRef: toolPanelRef.getAnimationStateRef() }
            : {}}
        />
      {:else if isGeneratorTab}
        <p class="empty-prompt">Tap Generate to create your sequence</p>
      {/if}
    </div>
```

With:
```svelte
    {#if !hasWorkspaceContent && isGeneratorTab}
      <p class="workspace-hint">Tap Generate to create your sequence</p>
    {/if}
    <div class="workspace-content">
      {#if hasWorkspaceContent}
        <CreationWorkspaceArea
          {animatingStepNumber}
          {currentDisplayWord}
          {buttonPanelHeight}
          letterSources={currentLetterSources}
          {...toolPanelRef?.getAnimationStateRef?.()
            ? { animationStateRef: toolPanelRef.getAnimationStateRef() }
            : {}}
        />
      {/if}
    </div>
```

- [ ] **Step 2: Replace `.empty-prompt` CSS with `.workspace-hint` CSS**

Replace (lines 388-400):
```css
  /* Simple prompt when workspace is empty */
  .empty-prompt {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    text-align: center;
  }
```

With:
```css
  .workspace-hint {
    flex-shrink: 0;
    text-align: center;
    font-size: clamp(1rem, 2.5vmin, 1.25rem);
    font-weight: 500;
    color: var(--theme-text, #fff);
    padding: clamp(8px, 1.5vmin, 12px) 1rem;
    margin: 0;
    letter-spacing: 0.02em;
  }
```

- [ ] **Step 3: Visual verification**

Check localhost:5173/create/generate — hint should appear at top of workspace area, not centered.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte
git commit -m "refactor: move Generate hint from center to top position"
```

---

### Task 2: Normalize Construct hint styling

**Files:**
- Modify: `src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte:211-217` (template)
- Modify: `src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte:342-364` (styles)

- [ ] **Step 1: Simplify the header markup**

Replace (lines 211-217):
```svelte
<div class="start-pos-picker" data-testid="start-position-picker">
  <!-- Shared header - outside animated content for consistent positioning -->
  <header class="picker-header">
    <div class="header-left"></div>
    <h2 class="start-position-title">Choose your start position</h2>
    <div class="header-right"></div>
  </header>
```

With:
```svelte
<div class="start-pos-picker" data-testid="start-position-picker">
  <p class="workspace-hint">Choose your start position</p>
```

- [ ] **Step 2: Replace header CSS with `.workspace-hint`**

Remove the `.picker-header`, `.header-left`, `.header-right`, and `.start-position-title` rules (lines 342-364) and add:

```css
  .workspace-hint {
    flex-shrink: 0;
    text-align: center;
    font-size: clamp(1rem, 2.5vmin, 1.25rem);
    font-weight: 500;
    color: var(--theme-text, #fff);
    padding: clamp(8px, 1.5vmin, 12px) 1rem;
    margin: 0;
    letter-spacing: 0.02em;
  }
```

- [ ] **Step 3: Visual verification**

Check localhost:5173/create/construct — hint should look similar but with normalized sizing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte
git commit -m "refactor: normalize Construct hint to workspace-hint style"
```

---

### Task 3: Normalize Assemble hint styling and remove redundant bottom hint

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte:85,156-164` (template + styles)
- Modify: `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte:165-170` (template)
- Modify: `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte:~220` (styles)

- [ ] **Step 1: Update BuilderInstructionHeader `.step-text` styling**

In BuilderInstructionHeader.svelte, update the `.step-title` CSS (lines 156-164):

Replace:
```css
  .step-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }
```

With:
```css
  .step-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: clamp(1rem, 2.5vmin, 1.25rem);
    font-weight: 500;
    color: var(--theme-text, #fff);
    letter-spacing: 0.02em;
  }
```

- [ ] **Step 2: Remove redundant bottom hint from BuilderTurnBar**

In BuilderTurnBar.svelte, replace the idle placeholder block (lines 165-170):

```svelte
  <!-- Idle only (no prior content to persist): show placeholder -->
  {#if showPlaceholder}
    <div class="bar-content bar-placeholder">
      <span class="bar-label muted">Tap a grid point to begin</span>
    </div>
  {/if}
```

With an empty placeholder that preserves layout:

```svelte
  <!-- Idle: empty placeholder preserves bar height -->
  {#if showPlaceholder}
    <div class="bar-content bar-placeholder">
      <span class="bar-label muted">&nbsp;</span>
    </div>
  {/if}
```

- [ ] **Step 3: Visual verification**

Check localhost:5173/create/assemble — top hint should be slightly smaller. Bottom bar should be empty when idle (no redundant text).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte src/lib/features/assemble-lab/components/BuilderTurnBar.svelte
git commit -m "refactor: normalize Assemble hint styling, remove redundant bottom hint"
```

---

### Task 4: Add Fuse tab hint

**Files:**
- Modify: `src/lib/features/fuse/components/FuseLayout.svelte:79-80` (template)
- Modify: `src/lib/features/fuse/components/FuseLayout.svelte:~129` (styles)

- [ ] **Step 1: Add hint state derivation**

In the `<script>` section of FuseLayout.svelte, after line 25 (`const showTempo = ...`), add:

```typescript
const showHint = $derived(state.leftSequence === null || state.rightSequence === null);
```

- [ ] **Step 2: Add hint markup above fuse-panels**

Replace (lines 79-80):
```svelte
<div class="fuse-layout">
	<div class="fuse-panels">
```

With:
```svelte
<div class="fuse-layout">
	{#if showHint}
		<p class="workspace-hint">Select two sequences to fuse</p>
	{/if}
	<div class="fuse-panels">
```

- [ ] **Step 3: Add `.workspace-hint` CSS**

In the `<style>` block of FuseLayout.svelte, add:

```css
	.workspace-hint {
		flex-shrink: 0;
		text-align: center;
		font-size: clamp(1rem, 2.5vmin, 1.25rem);
		font-weight: 500;
		color: var(--theme-text, #fff);
		padding: clamp(8px, 1.5vmin, 12px) 1rem;
		margin: 0;
		letter-spacing: 0.02em;
	}
```

- [ ] **Step 4: Visual verification**

Check localhost:5173/create/fuse — hint should appear at top, disappear when both sequences selected.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FuseLayout.svelte
git commit -m "feat: add workspace hint to Fuse tab"
```

---

### Task 5: Build check

- [ ] **Step 1: Run TypeScript check**

```bash
npm run check
```

Expected: No new errors introduced.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Final commit if any fixes needed**
