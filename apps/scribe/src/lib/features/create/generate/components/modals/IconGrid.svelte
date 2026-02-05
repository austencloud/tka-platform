<!--
IconGrid.svelte - Premium icon picker component
Provides a beautiful, consistent icon selection experience
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    selectedIcon = $bindable(),
    availableIcons = [
      "⚙️",
      "⭐",
      "🎯",
      "🔥",
      "💫",
      "✨",
      "🎪",
      "🎭",
      "🎨",
      "🌟",
      "💎",
      "🏆",
    ],
    label = "Choose an Icon",
  } = $props<{
    selectedIcon: string;
    availableIcons?: string[];
    label?: string;
  }>();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function selectIcon(icon: string) {
    hapticService?.trigger("selection");
    selectedIcon = icon;
  }
</script>

<div class="icon-picker">
  <div class="icon-label">{label}</div>
  <div class="icon-grid" role="group" aria-label="Icon selection">
    {#each availableIcons as icon}
      <button
        class="icon-button"
        class:selected={selectedIcon === icon}
        onclick={() => selectIcon(icon)}
        aria-label={`Select icon ${icon}`}
        aria-pressed={selectedIcon === icon}
      >
        <span class="icon-emoji">{icon}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .icon-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .icon-label {
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }

  .icon-button {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg, var(--theme-card-bg)),
      var(--theme-card-bg)
    );
    border: 2px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    position: relative;
    overflow: hidden;
  }

  .icon-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at center,
      var(--theme-stroke) 0%,
      transparent 70%
    );
    opacity: 0;
    transition: opacity var(--duration-emphasis) ease;
  }

  .icon-button:hover::before {
    opacity: 1;
  }

  .icon-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-text) 12%, transparent),
      color-mix(in srgb, var(--theme-text) 6%, transparent)
    );
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
    box-shadow:
      0 4px 12px var(--theme-shadow),
      0 0 0 1px var(--theme-stroke) inset;
  }

  .icon-button:active {
    transform: translateY(0);
  }

  .icon-button.selected {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 30%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 20%,
        transparent
      )
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 60%,
      transparent
    );
    box-shadow:
      0 0 0 3px
        color-mix(
          in srgb,
          var(--theme-accent, var(--semantic-info)) 20%,
          transparent
        ),
      0 4px 12px
        color-mix(
          in srgb,
          var(--theme-accent, var(--semantic-info)) 30%,
          transparent
        );
  }

  .icon-button.selected:hover {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 40%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 30%,
        transparent
      )
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 70%,
      transparent
    );
  }

  .icon-emoji {
    font-size: var(--font-size-3xl);
    line-height: 1;
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 2px 4px var(--theme-shadow));
  }

  @media (max-width: 640px) {
    .icon-grid {
      gap: 8px;
    }

    .icon-emoji {
      font-size: var(--font-size-2xl);
    }

    .icon-button {
      border-radius: 10px;
    }
  }
</style>
