<script lang="ts">
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import type { PostStudioExportProgress } from "$lib/shared/media-composition/services/post-studio-exporter";
  import type { PostStudioRoleKey } from "$lib/shared/media-composition/domain/post-studio-presets";
  import type { PostStudioSlotId } from "$lib/shared/media-composition/domain/post-studio-slots";
  import { ROLE_ICON, buildSourceMenuItems } from "./post-studio-source-menu";

  /**
   * What the post is made of, and the thing that turns it into a file.
   *
   * The two source pickers used to float on the artwork as chips sitting over
   * the top and bottom slots — they covered the picture they described, and a
   * control drawn on top of media reads as clutter. They belong here: the bar
   * runs left to right in the same order the slots run top to bottom, so the
   * post's whole recipe is one line, and picking what goes where is the most
   * prominent thing on the page rather than a chip you have to notice.
   *
   * It also gives the bar something to hold. Before this it carried a single
   * right-aligned Render button across the full width, which at 4K was a band
   * of nothing with a button parked at the end of it.
   */
  interface Props {
    missingCount: number;
    missingLabel?: string;
    canRender: boolean;
    exporting: boolean;
    exportProgress: PostStudioExportProgress | null;
    exportPercent: number;
    exportedUrl: string | null;
    exportFilename: string;
    onFixMissing: () => void;
    onRender: () => void;
    onCancelExport: () => void;
  }

  let {
    missingCount,
    missingLabel = "source",
    canRender,
    exporting,
    exportProgress,
    exportPercent,
    exportedUrl,
    exportFilename,
    onFixMissing,
    onRender,
    onCancelExport,
  }: Props = $props();

  const composition = getMediaCompositionContext();

  const SLOTS: Array<{
    id: PostStudioSlotId;
    position: string;
    glyph: string;
  }> = [
    { id: "top", position: "Top", glyph: "fa-solid fa-arrow-up" },
    { id: "bottom", position: "Bottom", glyph: "fa-solid fa-arrow-down" },
  ];

  /**
   * Every slot, occupied or not, in a fixed order. An empty slot keeps its
   * place and offers the same menu — so the bar's geometry never changes as
   * sources come and go, and adding a slot back is the same gesture as
   * changing one.
   */
  const slotEntries = $derived(
    SLOTS.map((slot) => {
      const roleKey = composition.roleForRegion(slot.id) as
        | PostStudioRoleKey
        | null;
      const binding = roleKey ? composition.bindingForRole(roleKey) : null;
      return {
        ...slot,
        roleKey,
        label: binding?.label ?? "Empty",
        icon: roleKey ? ROLE_ICON[roleKey] : "fa-solid fa-plus",
        missing: Boolean(roleKey) && binding?.status === "missing",
        selected: composition.selectedRegion?.id === slot.id,
      };
    })
  );

  const exportLabel = $derived(
    exportProgress?.phase === "audio"
      ? "Adding sound"
      : exportProgress?.phase === "encoding"
        ? "Encoding MP4"
        : "Rendering"
  );
</script>

<div class="actionbar">
  <div class="slots">
    {#each slotEntries as slot (slot.id)}
      <div class="slot-picker" class:selected={slot.selected}>
        <OverflowMenu
          items={buildSourceMenuItems(composition, slot.id, slot.roleKey)}
          placement="bottom"
          align="left"
          triggerClass="slot-trigger"
          ariaLabel={`${slot.position} slot: ${slot.label}. Change or remove.`}
        >
          {#snippet trigger()}
            <!-- Phone widths cannot carry the word TOP alongside a source name
                 without truncating the name, which is the part that changes.
                 The arrow replaces the word there; the trigger's aria-label
                 still reads "Top slot: …" either way. -->
            <i class={`slot-glyph ${slot.glyph}`} aria-hidden="true"></i>
            <i class={`slot-icon ${slot.icon}`} aria-hidden="true"></i>
            <span class="slot-position">{slot.position}</span>
            <span class="slot-label" class:missing={slot.missing}
              >{slot.label}</span
            >
            <i class="fa-solid fa-chevron-down caret" aria-hidden="true"></i>
          {/snippet}
        </OverflowMenu>
      </div>
    {/each}
  </div>

  <!-- The safe-area overlay is scaffolding: it belongs beside the thing that
       says what the post is made of, not buried in a per-layer panel where it
       reads as a property of the selected slot. Off by default, one click
       away when the composition needs measuring against Instagram's chrome. -->
  <button
    type="button"
    class="guide-toggle"
    class:active={composition.safeZonesVisible}
    aria-pressed={composition.safeZonesVisible}
    aria-label="Instagram safe area overlay"
    title="Instagram safe area — where the app's own controls sit over the post"
    onclick={composition.toggleSafeZones}
  >
    <i class="fa-solid fa-border-all" aria-hidden="true"></i>
  </button>

  <div class="state">
    {#if missingCount > 0}
      <button type="button" class="missing-state" onclick={onFixMissing}>
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        {missingCount === 1
          ? `${missingLabel} needed`
          : `${missingCount} sources needed`}
      </button>
    {/if}
  </div>

  <div class="export-actions">
    {#if exporting}
      <div class="export-progress" role="status" aria-live="polite">
        <span><strong>{exportLabel}</strong> {exportPercent}%</span>
        <span class="progress-track" aria-hidden="true">
          <span style:width={`${exportPercent}%`}></span>
        </span>
      </div>
      <button type="button" class="secondary-button" onclick={onCancelExport}>
        Cancel
      </button>
    {:else if exportedUrl}
      <a class="download-button" href={exportedUrl} download={exportFilename}>
        <i class="fa-solid fa-download" aria-hidden="true"></i>
        Download MP4
      </a>
      <button
        type="button"
        class="secondary-button rerender-button"
        disabled={!canRender}
        onclick={onRender}
      >
        Render again
      </button>
    {:else}
      <button
        type="button"
        class="render-button"
        disabled={!canRender}
        onclick={onRender}
      >
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        Render post
      </button>
    {/if}
  </div>
</div>

<style>
  .actionbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-height: 3.5rem;
    padding: 0.5rem var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .slots {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  .slot-picker :global(.slot-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min);
    cursor: pointer;
  }

  .slot-picker :global(.slot-trigger:hover) {
    border-color: var(--theme-stroke-strong);
  }

  .slot-picker.selected :global(.slot-trigger) {
    border-color: var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-card-bg));
  }

  .slot-glyph {
    display: none;
    color: var(--theme-text-dim);
    font-size: 0.8em;
  }

  .slot-position {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* The source name changes width as the slot changes — Animation, Choreo
     card, Performance, 3D view. Without a floor, picking a shorter one drags
     the second picker leftwards past it. Sized to the longest label so the two
     pickers hold station. */
  .slot-label {
    min-width: 8.5ch;
    overflow: hidden;
    font-weight: 600;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slot-label.missing {
    color: var(--semantic-warning);
  }

  .caret {
    color: var(--theme-text-dim);
    font-size: 0.7em;
  }

  .guide-toggle {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    min-height: 2.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
    cursor: pointer;
  }

  .guide-toggle:hover {
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .guide-toggle.active {
    border-color: color-mix(
      in srgb,
      var(--semantic-warning) 58%,
      var(--theme-stroke)
    );
    background: color-mix(in srgb, var(--semantic-warning) 12%, transparent);
    color: var(--semantic-warning);
  }

  .state,
  .export-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  /* The warning takes the slack so the render action sits hard right. Empty in
     the healthy case, which is the common one — a zero-width flex child, not a
     reserved band of dead air. */
  .state {
    flex: 1;
    justify-content: flex-end;
  }

  .missing-state {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 48%, transparent);
    border-radius: var(--radius-2026-sm);
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
    color: var(--semantic-warning);
    font: inherit;
    font-size: var(--font-size-compact);
    cursor: pointer;
  }

  .secondary-button,
  .render-button,
  .download-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .secondary-button {
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .render-button {
    border: 1px solid var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 62%, #24223d);
  }

  .download-button {
    border: 1px solid var(--semantic-success);
    background: color-mix(
      in srgb,
      var(--semantic-success) 14%,
      var(--theme-card-bg)
    );
    color: var(--semantic-success);
  }

  .render-button:disabled,
  .secondary-button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .secondary-button:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
  }

  .secondary-button:focus-visible,
  .render-button:focus-visible,
  .download-button:focus-visible,
  .guide-toggle:focus-visible,
  .missing-state:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .export-progress {
    display: grid;
    gap: var(--spacing-xs);
    width: 11rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-variant-numeric: tabular-nums;
  }

  .export-progress strong {
    color: var(--theme-text);
  }

  .progress-track {
    display: block;
    height: 0.35rem;
    overflow: hidden;
    border-radius: var(--radius-2026-full);
    background: var(--theme-stroke);
  }

  .progress-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--theme-accent);
    transition: width var(--duration-fast) linear;
  }

  @container post-studio (min-width: 105rem) {
    .actionbar {
      min-height: 4rem;
      padding: 0.625rem 1.25rem;
    }

    .missing-state,
    .secondary-button,
    .render-button,
    .download-button,
    .guide-toggle,
    .slot-picker :global(.slot-trigger) {
      min-height: 3.25rem;
    }

    .guide-toggle {
      width: 3.25rem;
      font-size: 0.9375rem;
    }

    .missing-state {
      font-size: 0.8125rem;
    }

    .secondary-button,
    .render-button,
    .download-button,
    .slot-picker :global(.slot-trigger) {
      font-size: 0.9375rem;
    }
  }

  @container post-studio (min-width: 180rem) {
    .actionbar {
      gap: 1.5rem;
      min-height: 5rem;
      padding: 0.75rem 2.5rem;
    }

    .state,
    .export-actions {
      gap: 1rem;
    }

    .slots {
      gap: 1rem;
    }

    .missing-state,
    .secondary-button,
    .render-button,
    .download-button,
    .guide-toggle,
    .slot-picker :global(.slot-trigger) {
      min-height: 3.75rem;
    }

    .guide-toggle {
      width: 3.75rem;
      font-size: 1.125rem;
    }

    .missing-state {
      font-size: 1rem;
    }

    .secondary-button,
    .render-button,
    .download-button,
    .slot-picker :global(.slot-trigger) {
      padding-inline: 1.25rem;
      font-size: 1.125rem;
    }

    .export-progress {
      width: 14rem;
      font-size: 1rem;
    }
  }

  @container post-studio (max-width: 70rem) {
    .actionbar {
      gap: var(--spacing-sm);
    }

    .rerender-button,
    .export-progress {
      display: none;
    }
  }

  /* Phone width: both pickers and the render action stay on ONE row. Wrapping
     the pickers below gave the render button a row of its own, which is the
     lone-button-on-an-empty-band shape this bar exists to avoid — at 375 it
     cost 22% of the screen height to say one word. */
  @container post-studio (max-width: 35rem) {
    .actionbar {
      gap: var(--spacing-xs);
      min-height: 3rem;
      padding-inline: var(--spacing-sm);
    }

    .slots {
      order: 0;
      flex: 1 1 auto;
      gap: var(--spacing-xs);
      min-width: 0;
    }

    .slot-picker {
      flex: 1 1 0;
      min-width: 0;
    }

    .slot-picker :global(.slot-trigger) {
      width: 100%;
      justify-content: flex-start;
      gap: 0.35rem;
      padding-inline: 0.5rem;
    }

    /* The arrow says which slot; the source name says what is in it. The
       source's own glyph is the one thing here that repeats information the
       name already carries, so it is what goes when space runs out. */
    .slot-glyph {
      display: inline;
    }

    .slot-icon,
    .slot-position {
      display: none;
    }

    /* The chevron is the next thing to go after the source glyph. It only
       advertises that the chip opens a menu, which the chip's own border and
       press already do — whereas the label is the answer to "what is in this
       slot", and at 375 it was clipping to "Anima…". Sixteen pixels back per
       picker is the difference between the full word and an ellipsis. */
    .caret {
      display: none;
    }

    .slot-label {
      min-width: 0;
    }

    /* Every child carries an explicit order here. An unset order is 0, which
       silently outranks its siblings and once put the render button alone on
       a row of its own above the pickers. */
    .guide-toggle {
      order: 1;
      width: 2.5rem;
    }

    .state {
      order: 2;
      flex: 0 1 auto;
      justify-content: flex-start;
    }

    .export-actions {
      order: 3;
      flex: 0 0 auto;
    }

    .render-button,
    .download-button {
      width: 2.75rem;
      padding: 0;
      font-size: 0;
    }

    .render-button i,
    .download-button i {
      font-size: var(--font-size-min);
    }

    .missing-state {
      padding-inline: 0.5rem;
      font-size: 0;
    }

    .missing-state i {
      font-size: var(--font-size-min);
    }
  }

  @media (max-height: 40rem) {
    .actionbar {
      min-height: 3rem;
      padding-block: var(--spacing-xs);
    }

    .rerender-button,
    .export-progress {
      display: none;
    }

    /* Short viewports drop the word for the arrow rather than dropping the
       position cue entirely — two chips with no top/bottom marker is a guess. */
    .slot-position {
      display: none;
    }

    .slot-glyph {
      display: inline;
    }
  }
</style>
