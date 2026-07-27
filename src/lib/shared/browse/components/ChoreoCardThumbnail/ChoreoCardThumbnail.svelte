<!--
ChoreoCardThumbnail.svelte

Ultra-minimal card component for the Browse grid.
Clicking the card opens the sequence detail viewer.

Uses PropAwareThumbnail for cloud-cached rendering:
- First user to view a prop type renders it locally
- Rendered image is uploaded to Firebase Storage
- All subsequent users get instant loading from cloud

Variation support:
- When a sequence has variations (same word, different authors/props/turns),
  a pill shows "1/3" etc. at the bottom
- Tapping the pill cycles through variations with crossfade

-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCardMenuSection } from "$lib/shared/choreo-card/services/card-menu-section";
  import { featureFlagService } from "$lib/shared/auth/services/post-hog-feature-flag-service.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { untrack } from "svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import VariationPill from "./VariationPill.svelte";
  import SyncStatusBadge from "./SyncStatusBadge.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { adminDeleteSequence } from "$lib/shared/library/services/admin-sequence-actions";
  import { notifyLibraryMutated } from "$lib/shared/library/library-events";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import { openCollectionPicker } from "$lib/features/library/state/collection-picker-state.svelte";

  let thumbnailRef = $state<ReturnType<typeof PropAwareThumbnail> | null>(null);

  // Cache for on-demand LOOP detection results (keyed by sequence ID)
  const {
    sequence,
    variations = [],
    onPrimaryAction = () => {},
    onHover,
    selected = false,
    bluePropType = undefined,
    redPropType = undefined,
    catDogModeEnabled = false,
    lightMode = false,
    eager = false,
    handPathMode = false,
    showBlueMotion = true,
    showRedMotion = true,
    addWord,
    addDifficultyLevel,
    allowQR = true,
    collectionContext,
    selectedIds,
  }: {
    sequence: SequenceData;
    variations?: SequenceData[];
    onPrimaryAction?: (sequence: SequenceData) => void;
    /** Fires on pointer enter (debounced 150ms) for cache pre-warming */
    onHover?: (sequence: SequenceData) => void;
    selected?: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
    /** Skip lazy loading - load thumbnails immediately (use in modals/pickers) */
    eager?: boolean;
    handPathMode?: boolean;
    /** Show blue motion (prop + arrow) in thumbnail. Default: true */
    showBlueMotion?: boolean;
    /** Show red motion (prop + arrow) in thumbnail. Default: true */
    showRedMotion?: boolean;
    addWord?: boolean;
    addDifficultyLevel?: boolean;
    /** Allow a baked-in QR (signed-in only, gated by the user's showQRCode
     * setting + a spare grid cell). Default true so the gallery honors the
     * setting. The QR variant is its own shared cache class (deterministic
     * short code), so it still loads from static/cloud — no per-card local
     * render. Pass false for surfaces too small to scan (e.g. peeks). */
    allowQR?: boolean;
    /**
     * Set when this card renders inside one of the viewer's own collections
     * (Browse > Collections detail). Adds a "Remove from this collection"
     * menu entry. Unlike "Add to collection…" this is NOT gated on owning the
     * sequence — a collection can hold other people's public sequences, and
     * taking one out of YOUR folder is always allowed.
     */
    collectionContext?: {
      id: string;
      name: string;
      onRemove: (sequenceId: string) => void;
    };
    /** Picker hosts: ids currently selected. Checked against the DISPLAYED
     * variation (the pill cycles it), not the base card — taps act on the
     * displayed sequence, so the outline must follow it. Overrides `selected`. */
    selectedIds?: ReadonlySet<string>;
  } = $props();

  // Track which variation is currently displayed.
  // Initialized to this card's own position in the variations array so each card
  // starts by showing its own base sequence (prevents duplicate view-transition-names).
  let currentVariationIndex = $state(0);

  // The sequence currently being shown (either the original or a variation)
  // Always fallback to the base sequence to guarantee non-undefined
  const displayedSequence: SequenceData = $derived.by(() => {
    if (variations.length > 1) {
      const variation = variations[currentVariationIndex];
      return variation ?? sequence;
    }
    return sequence;
  });

  // Total count for the pill
  const variationCount = $derived(variations.length > 1 ? variations.length : 0);

  // Cycle to next variation
  function handleCycleVariation() {
    if (variations.length > 1) {
      currentVariationIndex = (currentVariationIndex + 1) % variations.length;
    }
  }

  function handlePrimaryAction() {
    onPrimaryAction(displayedSequence);
  }

  // Debounced hover handler - avoids pre-warming during fast scroll-past
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  function handlePointerEnter() {
    if (!onHover) return;
    hoverTimer = setTimeout(() => {
      onHover(displayedSequence);
      hoverTimer = null;
    }, 150);
  }

  function handlePointerLeave() {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  // Reset to this card's own position ONLY when the base sequence identity changes
  // (e.g. the grid reuses this component for a different sequence).
  // variations access is untracked so that array reference changes (from parent
  // re-renders, virtualizer updates, etc.) don't reset the user's cycling.
  $effect(() => {
    const id = sequence.id;
    untrack(() => {
      if (variations.length > 1) {
        const ownIndex = variations.findIndex((v) => v.id === id);
        currentVariationIndex = ownIndex >= 0 ? ownIndex : 0;
      } else {
        currentVariationIndex = 0;
      }
    });
  });

  // ── Context menu (admin-only) ──────────────────────────────────────
  let contextMenuState: ContextMenuState = $state({ open: false });

  let removeConfirmOpen = $state(false);
  let removeTarget = $state<SequenceData | null>(null);

  // The collections picker is hosted at app level (CollectionPickerHost), not
  // here: unticking the collection being browsed unmounts this very card, and a
  // sheet owned by the card would vanish with it. See collection-picker-state.

  async function performRemove() {
    const seq = removeTarget;
    if (!seq) return;
    const myUid = authState.user?.uid;
    const isOwner = !!myUid && seq.ownerId === myUid;
    try {
      if (isOwner) {
        await getLibraryRepository().deleteSequence(seq.id);
      } else {
        const res = await adminDeleteSequence(seq.ownerId ?? "", seq.id);
        // The callable resolves even when it deleted nothing; treat that as a
        // failure so we don't show success + drop the card for a no-op delete.
        if (!res.deleted) throw new Error("Admin delete reported no deletion");
      }
      // Drives the browse engine's onLibraryMutated listener: removes the card
      // from the reactive grid state and the loader cache immediately.
      notifyLibraryMutated(seq.id);
      toast.success("Removed from library");
    } catch (err) {
      console.error("Remove from library failed:", err);
      toast.error("Failed to remove sequence");
    } finally {
      removeConfirmOpen = false;
      removeTarget = null;
    }
  }

  function handleSendTo() {
    const seq = displayedSequence;
    closeContextMenu();
    const propType = seq.intendedProp?.bluePropType ?? bluePropType ?? "staff";
    // Cloud thumbnails are keyed by sequence.word (not .name) - matches PropAwareThumbnail
    const thumbnailUrl = buildThumbnailUrl(seq.word || seq.name, propType, false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...seq, thumbnailUrl }));
  }

  const contextMenuItems: ContextMenuEntry[] = $derived.by(() => {
    const seq = displayedSequence;
    // Canonical card section (Re-render, Send to, admin image actions). No
    // pictograph section here: thumbnails are static cached images that don't
    // re-render on visibility toggles.
    const items: ContextMenuEntry[] = buildCardMenuSection({
      onRerender: () => {
        closeContextMenu();
        thumbnailRef?.forceRerender();
      },
      onSendTo: handleSendTo,
      isAdmin: featureFlagService.isAdmin,
      sequenceForImageActions: seq,
    });

    const myUid = authState.user?.uid;
    const isOwner = !!myUid && seq.ownerId === myUid;
    // Owner-only: filing into a collection is filing YOUR sequence into YOUR
    // collection. Admins viewing someone else's card don't get this (that would
    // reference a foreign sequence id — out of scope until save-to-library-first).
    if (isOwner) {
      items.push(
        { type: "separator" } as ContextMenuEntry,
        {
          id: "add-to-collection",
          label: "Collections…",
          icon: "fa-folder-plus",
          action() {
            closeContextMenu();
            openCollectionPicker({
              sequenceId: seq.id,
              sequenceLabel: seq.name,
              currentCollectionId: collectionContext?.id ?? null,
            });
          },
        },
      );
    }
    if (collectionContext) {
      const ctx = collectionContext;
      items.push(
        { type: "separator" } as ContextMenuEntry,
        {
          id: "remove-from-collection",
          label: `Remove from "${ctx.name}"`,
          icon: "fa-folder-minus",
          action() {
            closeContextMenu();
            ctx.onRemove(seq.id);
          },
        },
      );
    }
    if (isOwner || featureFlagService.isAdmin) {
      items.push(
        { type: "separator" } as ContextMenuEntry,
        {
          id: "remove-from-library",
          label: "Remove from library",
          icon: "fa-trash",
          danger: true,
          action() {
            closeContextMenu();
            removeTarget = seq;
            removeConfirmOpen = true;
          },
        },
      );
    }
    return items;
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuState = { open: true, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenuState = { open: false };
  }

  const isSelected = $derived(
    selectedIds ? selectedIds.has(displayedSequence.id) : selected,
  );
</script>

<button
  class="choreo-card"
  class:selected={isSelected}
  class:light-mode={lightMode}
  onclick={handlePrimaryAction}
  oncontextmenu={handleContextMenu}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
>
  <!-- view-transition-name enables Google Photos-style morph animation to /sequence/[id] -->
  <div
    class="thumbnail-container"
    class:crossfade={variationCount > 0}
    style:view-transition-name="sequence-{displayedSequence.id}"
  >
    <PropAwareThumbnail
      bind:this={thumbnailRef}
      sequence={displayedSequence}
      {bluePropType}
      {redPropType}
      {catDogModeEnabled}
      {lightMode}
      {eager}
      {handPathMode}
      {showBlueMotion}
      {showRedMotion}
      {addWord}
      {addDifficultyLevel}
      {allowQR}
      userName={displayedSequence.ownerDisplayName}
    />
  </div>

  <SyncStatusBadge status={displayedSequence.syncStatus} />

  <VariationPill
    currentIndex={currentVariationIndex}
    totalCount={variationCount}
    onCycle={handleCycleVariation}
  />
</button>

<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeContextMenu} />

<ConfirmDialog
  bind:isOpen={removeConfirmOpen}
  title="Remove from library?"
  message="This permanently removes this sequence. It can't be undone."
  confirmText="Remove"
  cancelText="Keep"
  variant="danger"
  onConfirm={performRemove}
  onCancel={() => { removeConfirmOpen = false; removeTarget = null; }}
/>

<style>
  .choreo-card {
    position: relative;
    border-radius: 0;
    overflow: hidden;
    background: transparent;
    border: none;
    color: var(--theme-text);
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;

    container-type: inline-size;
    container-name: choreo-card;

    cursor: pointer;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .choreo-card:hover {
    transform: scale(1.02);
  }

  /* Active state - brief feedback on touch/mobile only */
  @media (hover: none) and (pointer: coarse) {
    .choreo-card:active {
      transform: scale(0.98);
      transition-duration: var(--duration-instant);
    }
  }

  .choreo-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .choreo-card.selected {
    outline: 2px solid color-mix(in srgb, var(--semantic-info) 80%, transparent);
    outline-offset: 2px;
  }

  /* Light mode: transparent background, images handle their own bg */
  .choreo-card.light-mode {
    background: transparent;
  }

  /* Thumbnail container for crossfade animation */
  .thumbnail-container {
    width: 100%;
    height: 100%;
  }

  /* Smooth crossfade when cycling variations */
  .thumbnail-container.crossfade :global(img),
  .thumbnail-container.crossfade :global(.placeholder) {
    transition: opacity var(--duration-normal) ease-out;
  }

  /* On mobile, suppress the morph view-transition-name so the drawer
     slide-up animation isn't fighting with a morph animation */
  @media (max-width: 767px) {
    .thumbnail-container {
      view-transition-name: none !important;
    }
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .choreo-card {
      transition: none;
    }
    .choreo-card:hover,
    .choreo-card:active {
      transform: none;
    }
  }
</style>
