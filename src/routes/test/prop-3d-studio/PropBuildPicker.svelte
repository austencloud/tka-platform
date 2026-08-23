<script lang="ts" generics="T extends string">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { popIn } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { PropBuildPreviewOption } from "./prop-build-previews";

  interface Props {
    label: string;
    value: T;
    options: readonly PropBuildPreviewOption<T>[];
    onchange: (value: T) => void;
    density?: "primary" | "secondary";
  }

  let {
    label,
    value,
    options,
    onchange,
    density = "primary",
  }: Props = $props();

  function moveSelection(event: KeyboardEvent, index: number): void {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const option = options[nextIndex];
    if (!option) return;

    onchange(option.id);
    const group = (event.currentTarget as HTMLElement).closest(
      '[role="radiogroup"]'
    );
    const buttons =
      group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[nextIndex]?.focus();
  }
</script>

<section class="picker" class:secondary={density === "secondary"}>
  <span class="picker-label">{label}</span>
  <div class="option-grid" role="radiogroup" aria-label={label}>
    {#each options as option, index (option.id)}
      <button
        type="button"
        class="option"
        class:selected={value === option.id}
        role="radio"
        aria-checked={value === option.id}
        tabindex={value === option.id ? 0 : -1}
        onclick={() => onchange(option.id)}
        onkeydown={(event) => moveSelection(event, index)}
      >
        <span class="preview-frame">
          <Crossfade key={option.image} duration={DURATION.normal} fill>
            <img
              src={option.image}
              alt=""
              draggable="false"
              style:--preview-scale={option.imageScale ?? 1}
            />
          </Crossfade>
        </span>
        <span class="option-label">{option.label}</span>
        {#if value === option.id}
          <span
            class="selected-badge"
            aria-hidden="true"
            transition:popIn={{ duration: DURATION.fast, start: 0.72 }}>✓</span
          >
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .picker {
    container-type: inline-size;
    min-width: 0;
  }

  .picker-label {
    display: block;
    margin-bottom: 7px;
    color: rgba(255, 255, 255, 0.58);
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .option-grid {
    display: grid;
    grid-template-columns: repeat(var(--build-option-count, 3), minmax(0, 1fr));
    gap: clamp(8px, 1.1cqi, 12px);
    min-width: 0;
  }

  .option {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--studio-stroke);
    border-radius: var(--settings-border-radius-lg, 16px);
    background: #070911;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition:
      transform var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .preview-frame {
    position: relative;
    display: grid;
    place-items: center;
    height: clamp(92px, 9cqi, 112px);
    overflow: hidden;
    background:
      radial-gradient(
        circle at 50% 42%,
        rgba(111, 132, 176, 0.14),
        transparent 62%
      ),
      #070911;
  }

  .preview-frame img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    transform: scale(var(--preview-scale));
    filter: saturate(1.04) contrast(1.04);
    transition: transform var(--duration-fast, 150ms) ease;
  }

  .preview-frame :global(.crossfade) {
    position: absolute;
    inset: 0;
  }

  .option-label {
    z-index: 1;
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 8px 12px 9px;
    overflow: hidden;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(3, 4, 9, 0.96);
    font-size: var(--font-size-min, 14px);
    font-weight: 760;
    line-height: 1.2;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .option.selected {
    border-color: color-mix(in srgb, var(--studio-accent) 82%, white);
    color: #fff;
    box-shadow:
      0 9px 24px color-mix(in srgb, var(--studio-accent) 24%, transparent),
      inset 0 0 0 2px color-mix(in srgb, var(--studio-accent) 46%, transparent);
  }

  .option.selected .option-label {
    border-top-color: color-mix(in srgb, var(--studio-accent) 24%, transparent);
    background: color-mix(in srgb, var(--studio-accent) 11%, #030409);
  }

  .selected-badge {
    position: absolute;
    top: 9px;
    right: 9px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid color-mix(in srgb, var(--studio-accent) 70%, white);
    border-radius: 50%;
    background: color-mix(in srgb, var(--studio-accent) 82%, #090b13);
    box-shadow: 0 0 14px
      color-mix(in srgb, var(--studio-accent) 74%, transparent);
    color: #fff;
    font-size: 13px;
    font-weight: 900;
    line-height: 1;
  }

  .option:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--studio-accent) 72%, white);
    outline-offset: 2px;
  }

  .option:active {
    transform: translateY(0) scale(0.985);
  }

  @media (hover: hover) and (pointer: fine) {
    .option:hover {
      border-color: color-mix(in srgb, var(--studio-accent) 54%, white);
      transform: translateY(-2px);
    }

    .option:hover img {
      transform: scale(calc(var(--preview-scale) * 1.04));
    }
  }

  .picker.secondary .option-grid {
    --build-option-count: 2;
  }

  .picker.secondary .preview-frame {
    height: clamp(84px, 8cqi, 100px);
  }

  /* Modifiers are deliberately quieter than the primary build choice. The
     check stays unambiguous, but the card no longer competes with Build for
     the strongest accent treatment. */
  .picker.secondary .option.selected {
    border-color: color-mix(in srgb, var(--studio-accent) 44%, white);
    box-shadow:
      0 6px 18px color-mix(in srgb, var(--studio-accent) 14%, transparent),
      inset 0 0 0 1px color-mix(in srgb, var(--studio-accent) 28%, transparent);
  }

  .picker.secondary .option.selected .option-label {
    border-top-color: color-mix(in srgb, var(--studio-accent) 16%, transparent);
    background: color-mix(in srgb, var(--studio-accent) 6%, #030409);
  }

  .picker.secondary .selected-badge {
    width: 19px;
    height: 19px;
    border-color: color-mix(in srgb, var(--studio-accent) 42%, white);
    background: color-mix(in srgb, var(--studio-accent) 46%, #090b13);
    box-shadow: 0 0 9px
      color-mix(in srgb, var(--studio-accent) 34%, transparent);
    font-size: 11px;
  }

  @container (max-width: 330px) {
    .picker.secondary .option-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .option,
    .option-label,
    .preview-frame img {
      transition: none;
    }
  }
</style>
