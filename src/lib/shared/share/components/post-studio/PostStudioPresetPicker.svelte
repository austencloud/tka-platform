<script lang="ts">
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";

  const composition = getMediaCompositionContext();

  let {
    compact = false,
    rail = false,
    onSavePreset,
  }: {
    compact?: boolean;
    rail?: boolean;
    onSavePreset?: (name: string) => Promise<void>;
  } = $props();
  let saveOpen = $state(false);
  let presetName = $state("");
  let saving = $state(false);
  let saveError = $state("");

  function openSave(): void {
    presetName = `${composition.activePreset.name} preset`;
    saveError = "";
    saveOpen = true;
  }

  async function savePreset(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!onSavePreset || !presetName.trim() || saving) return;
    saving = true;
    saveError = "";
    try {
      await onSavePreset(presetName.trim());
      saveOpen = false;
    } catch (error) {
      saveError =
        error instanceof Error ? error.message : "Could not save this preset.";
    } finally {
      saving = false;
    }
  }

  function tone(roleKey: string): string {
    if (roleKey === "performance-video") return "performance";
    if (roleKey === "sequence-animation") return "animation";
    return "card";
  }

  function missingRoleKeys(
    preset: (typeof composition.presets)[number]
  ): string[] {
    return preset.sourceRoles.flatMap((role) => {
      const binding = composition.bindings.find(
        (candidate) => candidate.roleKey === role.key
      );
      return role.required && binding?.status !== "ready" ? [role.key] : [];
    });
  }

  function selectPreset(preset: (typeof composition.presets)[number]): void {
    const missing = missingRoleKeys(preset);
    composition.selectPreset(preset.id);
    if (missing[0]) composition.requestSource(missing[0]);
  }
</script>

<section
  class="preset-section"
  class:compact
  class:rail
  aria-labelledby="post-studio-layouts"
>
  <div class="section-heading">
    <div>
      <span class="eyebrow">Templates</span>
      <h3 id="post-studio-layouts">Layouts</h3>
    </div>
    <div class="heading-actions">
      <span class="count">{composition.presets.length}</span>
      {#if onSavePreset}
        <button type="button" class="save-toggle" onclick={openSave}>
          <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
          Save layout
        </button>
      {/if}
    </div>
  </div>

  {#if saveOpen}
    <form class="save-row" onsubmit={savePreset}>
      <label for="post-studio-preset-name">Preset name</label>
      <input
        id="post-studio-preset-name"
        bind:value={presetName}
        maxlength="120"
        autocomplete="off"
      />
      <button type="submit" disabled={!presetName.trim() || saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        class="save-cancel"
        aria-label="Cancel saving preset"
        onclick={() => (saveOpen = false)}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      {#if saveError}
        <p role="alert">{saveError}</p>
      {/if}
    </form>
  {/if}

  <div class="preset-grid" role="radiogroup" aria-label="Post layout">
    {#each composition.presets as preset (preset.id)}
      <button
        type="button"
        class="preset-card"
        class:selected={composition.activePresetId === preset.id}
        role="radio"
        aria-checked={composition.activePresetId === preset.id}
        onclick={() => selectPreset(preset)}
      >
        <span class="mini-frame" aria-hidden="true">
          {#each preset.regions as region (region.id)}
            {@const clip = preset.clips.find(
              (item) => item.kind === "visual" && item.regionId === region.id
            )}
            <span
              class="mini-region {tone(clip?.sourceRole ?? 'choreo-card')}"
              style={`left:${region.x * 100}%;top:${region.y * 100}%;width:${region.width * 100}%;height:${region.height * 100}%`}
            ></span>
          {/each}
        </span>
        <span class="preset-copy">
          <strong>{preset.name}</strong>
          <span>{preset.description}</span>
        </span>
        {#if missingRoleKeys(preset).length > 0}
          <span class="missing-badge">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            Needs source
          </span>
        {/if}
        <i class="fa-solid fa-check selected-mark" aria-hidden="true"></i>
      </button>
    {/each}
  </div>
</section>

<style>
  .preset-section {
    display: grid;
    gap: 0.75rem;
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .heading-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .eyebrow {
    display: block;
    margin-bottom: 0.2rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
  }

  h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: var(--studio-section-title-size, 1.15rem);
    line-height: 1.1;
  }

  .count {
    display: grid;
    place-items: center;
    min-width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.68));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
  }

  .save-toggle,
  .save-row button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: var(--studio-control-height, 2.75rem);
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.7rem;
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--studio-body-size, var(--font-size-min, 0.875rem));
    cursor: pointer;
  }

  .save-toggle:hover,
  .save-row button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 68%, white);
    background: rgba(255, 255, 255, 0.085);
  }

  .save-toggle:focus-visible,
  .save-row input:focus-visible,
  .save-row button:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .save-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b7cff) 34%, transparent);
    border-radius: 0.8rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 7%,
      transparent
    );
  }

  .save-row label {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.68));
    font-size: var(--studio-body-size, var(--font-size-min, 0.875rem));
    font-weight: 600;
  }

  .save-row input {
    min-width: 0;
    min-height: var(--studio-control-height, 2.75rem);
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.13));
    border-radius: 0.65rem;
    background: rgba(0, 0, 0, 0.22);
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--studio-body-size, var(--font-size-min, 0.875rem));
  }

  .save-row button[type="submit"] {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 64%, white);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 25%,
      transparent
    );
  }

  .save-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-row .save-cancel {
    width: 2.75rem;
    padding: 0;
  }

  .save-row p {
    grid-column: 2 / -1;
    margin: 0;
    color: #ffb3b3;
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
  }

  .preset-card {
    position: relative;
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.625rem;
    min-height: 4.75rem;
    padding: 0.65rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.875rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    color: var(--theme-text, #fff);
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease,
      transform var(--duration-fast, 120ms) ease;
  }

  .preset-card:hover,
  .preset-card.selected {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 80%, white);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 13%,
      var(--theme-card-bg, #17171d)
    );
  }

  .preset-card:active {
    transform: scale(0.985);
  }

  .preset-card:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .mini-frame {
    position: relative;
    display: block;
    width: 2.25rem;
    aspect-ratio: 9 / 16;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.3rem;
    background: #09090d;
  }

  .mini-region {
    position: absolute;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .mini-region.performance {
    background: linear-gradient(145deg, #ad4c7a, #4b254e);
  }

  .mini-region.animation {
    background: linear-gradient(145deg, #4d65da, #222b67);
  }

  .mini-region.card {
    background:
      linear-gradient(
        90deg,
        transparent 47%,
        rgba(255, 255, 255, 0.17) 48% 52%,
        transparent 53%
      ),
      linear-gradient(
        #202027 47%,
        rgba(255, 255, 255, 0.14) 48% 52%,
        #202027 53%
      );
  }

  .preset-copy {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .preset-copy strong {
    padding-right: 1.25rem;
    font-size: var(--studio-body-size, var(--font-size-min, 0.875rem));
    line-height: 1.2;
  }

  .preset-copy span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.62));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
    line-height: 1.3;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .selected-mark {
    position: absolute;
    top: 0.55rem;
    right: 0.55rem;
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 999px;
    background: var(--theme-accent, #8b7cff);
    opacity: 0;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    transform: scale(0.7);
    transition:
      opacity var(--duration-fast, 120ms) ease,
      transform var(--duration-fast, 120ms) ease;
  }

  .preset-card.selected .selected-mark {
    opacity: 1;
    transform: scale(1);
  }

  .preset-section.compact .preset-card {
    min-height: 4rem;
    padding-block: 0.5rem;
  }

  .preset-section.compact .preset-copy span {
    display: none;
  }

  .preset-section.rail .preset-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .preset-section.rail .preset-card {
    min-height: 4.25rem;
  }

  .preset-section.rail .preset-copy span {
    -webkit-line-clamp: 1;
  }

  .missing-badge {
    position: absolute;
    right: 0.55rem;
    bottom: 0.45rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--semantic-warning);
    font-size: var(--font-size-compact);
    font-weight: 700;
  }

  .preset-card:has(.missing-badge) .preset-copy strong {
    padding-right: 4.75rem;
  }

  @container post-studio (max-width: 31rem) {
    .preset-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .save-row {
      grid-template-columns: minmax(0, 1fr) auto auto;
    }

    .save-row label {
      grid-column: 1 / -1;
    }

    .save-row p {
      grid-column: 1 / -1;
    }
  }

  @container post-studio (min-width: 105rem) {
    .preset-grid {
      gap: 0.875rem;
    }

    .preset-card {
      grid-template-columns: 3rem minmax(0, 1fr);
      min-height: 5.5rem;
      padding: 0.875rem;
      border-radius: 1.125rem;
    }

    .mini-frame {
      width: 2.75rem;
    }

    .preset-copy strong {
      font-size: var(--studio-body-size, 1rem);
    }

    .preset-copy span,
    .eyebrow,
    .count {
      font-size: var(--studio-meta-size, 0.8125rem);
    }
  }

  @container post-studio (min-width: 180rem) {
    .preset-grid {
      gap: 1.25rem;
    }

    .preset-card {
      grid-template-columns: 4.25rem minmax(0, 1fr);
      min-height: 7.5rem;
      padding: 1.25rem;
      border-radius: 1.25rem;
    }

    .mini-frame {
      width: 3.75rem;
    }

    .preset-copy strong {
      font-size: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-card,
    .selected-mark {
      transition: none;
    }
  }
</style>
