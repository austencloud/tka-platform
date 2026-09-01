<script lang="ts">
  import { onMount } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import KeyboardKeyDisplay from "$lib/shared/keyboard/components/settings/KeyboardKeyDisplay.svelte";
  import { getShortcutCustomizer } from "$lib/shared/keyboard/get-shortcut-customizer";
  import { getShortcutRegistry } from "$lib/shared/keyboard/get-shortcut-registry";
  import { keyboardShortcutState } from "$lib/shared/keyboard/state/keyboard-shortcut-state.svelte";
  import type { ShortcutCustomizer } from "$lib/shared/keyboard/services/shortcut-customizer";
  import { createAltHoldIntent } from "./alt-hold-intent";
  import { buildCreateAltShortcutHints } from "./create-alt-shortcut-hints";

  let customizer = $state<ShortcutCustomizer | null>(null);
  let registryVersion = $state(0);
  let hintsVisible = $state(false);
  let desktopInteraction = $state(false);

  const hintModel = $derived.by(() => {
    registryVersion;
    keyboardShortcutState.settings;
    return buildCreateAltShortcutHints(
      customizer?.getAllShortcutsWithBindings() ?? []
    );
  });

  const holdIntent = createAltHoldIntent({
    onVisibilityChange: (visible) => (hintsVisible = visible),
  });

  function isEditingText(): boolean {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    return (
      active.matches("input, textarea, select") ||
      active.isContentEditable ||
      active.closest("[contenteditable='true']") !== null
    );
  }

  function openShortcutCenter(): void {
    keyboardShortcutState.openHelp({
      view: "current",
      query: "Alt+",
    });
  }

  onMount(() => {
    customizer = getShortcutCustomizer();
    const shortcutRegistry = getShortcutRegistry();
    registryVersion += 1;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateDesktopInteraction = () => {
      desktopInteraction = finePointer.matches && window.innerWidth >= 768;
      if (!desktopInteraction) holdIntent.cancel();
    };

    function handleKeyDown(event: KeyboardEvent): void {
      if (!desktopInteraction) return;

      if (event.key === "Alt") {
        if (event.repeat || isEditingText()) return;
        event.preventDefault();
        if (keyboardShortcutState.showHints) holdIntent.press();
        return;
      }

      if (event.altKey) holdIntent.useChord();
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === "Alt") holdIntent.release();
    }

    function handleVisibilityChange(): void {
      if (document.hidden) holdIntent.cancel();
    }

    updateDesktopInteraction();
    const unsubscribeRegistry = shortcutRegistry.subscribe(
      () => (registryVersion += 1)
    );
    finePointer.addEventListener("change", updateDesktopInteraction);
    window.addEventListener("resize", updateDesktopInteraction);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", holdIntent.cancel);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      holdIntent.cancel();
      unsubscribeRegistry();
      finePointer.removeEventListener("change", updateDesktopInteraction);
      window.removeEventListener("resize", updateDesktopInteraction);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", holdIntent.cancel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });
</script>

<div class="create-shortcut-header">
  <div
    class="shortcut-hints"
    class:visible={hintsVisible}
    aria-hidden={!hintsVisible}
  >
    <span class="alt-key">
      <KeyboardKeyDisplay
        parsed={{ key: "", modifiers: ["alt"] }}
        size="small"
      />
    </span>

    {#if hintModel.rotate.length > 0}
      <span class="hint-group">
        <span class="hint-keys">
          {#each hintModel.rotate as hint (hint.id)}
            <KeyboardKeyDisplay parsed={hint.binding} size="small" />
          {/each}
        </span>
        <span class="hint-label">Rotate</span>
      </span>
    {/if}

    {#if hintModel.transforms.length > 0}
      <span class="transform-hints">
        {#each hintModel.transforms as hint (hint.id)}
          <span class="hint-group transform-hint">
            <KeyboardKeyDisplay parsed={hint.binding} size="small" />
            <span class="hint-label">{hint.label}</span>
          </span>
        {/each}
        <span class="hint-label compact-transform-label">Actions</span>
      </span>
    {/if}

    {#if hintModel.propSummary}
      <span class="hint-group props-hint">
        <KeyboardKeyDisplay parsed={hintModel.propSummary} size="small" />
        <span class="hint-label">Props</span>
      </span>
    {/if}
  </div>

  <span class="shortcut-launcher">
    <PanelButton
      onclick={openShortcutCenter}
      ariaLabel="Open Create keyboard shortcuts"
    >
      <i class="fas fa-keyboard" aria-hidden="true"></i>
      <span class="launcher-label">Shortcuts</span>
      <span class="launcher-key" aria-hidden="true">
        <KeyboardKeyDisplay keyCombo="Shift+/" size="small" />
      </span>
    </PanelButton>
  </span>
</div>

<style>
  .create-shortcut-header {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: clamp(8px, 1cqi, 14px);
    min-width: 0;
  }

  .shortcut-hints {
    min-width: 0;
    height: var(--min-touch-target, 44px);
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: clamp(6px, 0.7cqi, 11px);
    overflow: hidden;
    background: var(--theme-panel-bg);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--transition-fast),
      visibility 0s linear var(--duration-fast);
  }

  .shortcut-hints.visible {
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }

  .alt-key,
  .hint-group,
  .hint-keys,
  .transform-hints,
  .shortcut-launcher {
    display: inline-flex;
    align-items: center;
  }

  .hint-group {
    flex: 0 0 auto;
    gap: 5px;
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .hint-keys {
    gap: 3px;
  }

  .transform-hints {
    flex: 0 0 auto;
    gap: clamp(6px, 0.7cqi, 11px);
  }

  .hint-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .compact-transform-label {
    display: none;
    color: var(--theme-text-dim);
  }

  .shortcut-launcher {
    flex: 0 0 auto;
  }

  .shortcut-launcher :global(.panel-btn) {
    padding-inline: 12px;
    white-space: nowrap;
  }

  .shortcut-launcher i {
    font-size: var(--font-size-min, 14px);
  }

  .launcher-key {
    display: inline-flex;
  }

  @container (max-width: 1100px) {
    .transform-hints {
      gap: 3px;
    }

    .transform-hint {
      gap: 0;
    }

    .transform-hint .hint-label {
      display: none;
    }

    .compact-transform-label {
      display: inline;
      margin-left: 2px;
    }

    .launcher-label,
    .launcher-key {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .shortcut-launcher :global(.panel-btn) {
      width: var(--min-touch-target, 44px);
      padding-inline: 0;
    }
  }

  @container (max-width: 860px) {
    .shortcut-hints {
      gap: 6px;
    }

    .hint-group {
      gap: 3px;
    }
  }

  @container (max-width: 767px) {
    .create-shortcut-header {
      display: none;
    }
  }

  @media (hover: none) and (pointer: coarse) {
    .create-shortcut-header {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shortcut-hints {
      transition: none;
    }
  }
</style>
