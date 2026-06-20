<script lang="ts">
  /**
   * Shortcuts Help Dialog
   *
   * Displays all available keyboard shortcuts organized by category.
   *
   * Domain: Keyboard Shortcuts - UI
   */

  import { onMount } from "svelte";
  import type { KeyboardShortcutManager } from '$lib/shared/keyboard/services/keyboard-shortcut-manager'
  import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
  import type {
    ShortcutRegistrationOptions,
    ShortcutScope,
  } from "../domain/types/keyboard-types";
  import { getKeyboardShortcutManager } from "../get-keyboard-shortcut-manager";

  // Service
  let shortcutService: KeyboardShortcutManager | null = null;

  // Shortcuts grouped by scope
  let shortcutsByScope = $state<
    Map<ShortcutScope, ShortcutRegistrationOptions[]>
  >(new Map());

  onMount(async () => {
    try {
      shortcutService = getKeyboardShortcutManager();
      loadShortcuts();
    } catch (error) {
      console.error("Failed to resolve shortcut service:", error);
    }
  });

  function loadShortcuts() {
    if (!shortcutService) return;

    const allShortcuts = shortcutService.getAllShortcuts();
    const grouped = new Map<ShortcutScope, ShortcutRegistrationOptions[]>();

    for (const shortcut of allShortcuts) {
      const scope = shortcut.scope ?? "action";
      if (!grouped.has(scope)) {
        grouped.set(scope, []);
      }
      grouped.get(scope)!.push(shortcut);
    }

    shortcutsByScope = grouped;
  }

  function close() {
    keyboardShortcutState.closeHelp();
  }

  function formatShortcut(shortcut: ShortcutRegistrationOptions): string {
    const isMac = keyboardShortcutState.isMac;
    const modifiers = shortcut.modifiers ?? [];

    const modifierStrings = modifiers.map((mod) => {
      switch (mod) {
        case "ctrl":
          return isMac ? "⌘" : "Ctrl";
        case "meta":
          return isMac ? "⌘" : "Win";
        case "alt":
          return isMac ? "⌥" : "Alt";
        case "shift":
          return isMac ? "⇧" : "Shift";
        default:
          return mod;
      }
    });

    const keyString = formatKey(shortcut.key);

    return [...modifierStrings, keyString].join(isMac ? "" : "+");
  }

  function formatKey(key: string): string {
    const keyMap: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Enter: "↵",
      Escape: "Esc",
      Backspace: "⌫",
      Delete: "⌦",
      Space: "Space",
      Tab: "⇥",
    };

    return keyMap[key] || key.toUpperCase();
  }

  function getScopeLabel(scope: ShortcutScope): string {
    const labels: Record<ShortcutScope, string> = {
      navigation: "Navigation",
      action: "Actions",
      editing: "Editing",
      panel: "Panels",
      focus: "Focus Management",
      help: "Help & Information",
      "sequence-management": "Sequence Management",
      animation: "Animation",
      workspace: "Workspace",
      playback: "Playback",
      view: "View",
      selection: "Selection",
      special: "Special",
      admin: "Admin Tools",
    };

    return labels[scope] || scope;
  }

  function getScopeDescription(scope: ShortcutScope): string {
    const descriptions: Record<ShortcutScope, string> = {
      navigation: "Switch between modules and navigate the app",
      action: "Execute actions and commands",
      editing: "Edit and modify content",
      panel: "Manage panels and dialogs",
      focus: "Move focus between UI regions",
      help: "Access help and documentation",
      "sequence-management": "Save, add, delete steps and manage sequences",
      animation: "Control animation playback and settings",
      workspace: "Navigate and interact with the workspace",
      playback: "Media playback controls",
      view: "Toggle views and display options",
      selection: "Selection operations",
      special: "Miscellaneous shortcuts",
      admin: "Admin-only debug tools and impersonation",
    };

    return descriptions[scope] || "";
  }

  // Sort scopes in a logical order, including all that have shortcuts
  let sortedScopes = $derived.by(() => {
    const order: ShortcutScope[] = [
      "playback",
      "view",
      "navigation",
      "action",
      "editing",
      "panel",
      "animation",
      "workspace",
      "sequence-management",
      "selection",
      "focus",
      "help",
      "special",
      "admin",
    ];

    // Get all scopes that have shortcuts
    const scopesWithShortcuts = Array.from(shortcutsByScope.keys());

    // Return ordered scopes first, then any remaining
    const orderedScopes = order.filter((scope) => shortcutsByScope.has(scope));
    const remainingScopes = scopesWithShortcuts.filter(
      (scope) => !order.includes(scope)
    );

    return [...orderedScopes, ...remainingScopes];
  });
</script>

{#if keyboardShortcutState.showHelp}
  <div
    class="shortcuts-help-overlay"
    onclick={close}
    onkeydown={(e) => {
      if (e.key === "Escape") close();
    }}
    role="button"
    tabindex="0"
    aria-label="Close keyboard shortcuts help"
  >
    <div
      class="shortcuts-help"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Keyboard Shortcuts Help"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="shortcuts-help__header">
        <div>
          <h2 class="shortcuts-help__title">Keyboard Shortcuts</h2>
          <p class="shortcuts-help__subtitle">
            Use these shortcuts to navigate faster
          </p>
        </div>
        <button
          class="shortcuts-help__close"
          onclick={close}
          aria-label="Close"
          type="button"
        >
          <i class="fa fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="shortcuts-help__content themed-scrollbar">
        {#if sortedScopes.length === 0}
          <div class="shortcuts-help__empty">No shortcuts available</div>
        {:else}
          <div class="shortcuts-help__grid">
            {#each sortedScopes as scope}
              {@const shortcuts = shortcutsByScope.get(scope) ?? []}
              {#if shortcuts.length > 0}
                <section class="shortcuts-help__section">
                  <h3 class="shortcuts-help__section-title">
                    {getScopeLabel(scope)}
                  </h3>
                  <div class="shortcuts-help__list">
                    {#each shortcuts as shortcut}
                      <div class="shortcuts-help__item">
                        <span class="shortcuts-help__item-label">
                          {shortcut.label}
                        </span>
                        <kbd class="shortcuts-help__item-keys">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    {/each}
                  </div>
                </section>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="shortcuts-help__footer">
        <span> Press H to toggle this dialog </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .shortcuts-help-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--theme-shadow, #000) 70%, transparent);
    backdrop-filter: blur(8px);
    z-index: var(--z-tooltip);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .shortcuts-help {
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    /* Dark glass panel */
    background: var(
      --theme-panel-bg,
      color-mix(in srgb, var(--theme-shadow, #000) 50%, transparent)
    );
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    box-shadow: var(
      --theme-panel-shadow,
      0 20px 60px color-mix(in srgb, var(--theme-shadow, #000) 50%, transparent)
    );
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .shortcuts-help__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--theme-stroke);
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 5%,
      transparent
    );
  }

  .shortcuts-help__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .shortcuts-help__subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .shortcuts-help__close {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    margin: -8px -8px 0 0;
  }

  .shortcuts-help__close:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .shortcuts-help__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .shortcuts-help__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .shortcuts-help__section {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 1rem;
  }

  .shortcuts-help__section-title {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-accent-strong);
  }

  .shortcuts-help__list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .shortcuts-help__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    background: var(--theme-card-bg);
    border-radius: 6px;
    gap: 0.75rem;
    transition: background var(--duration-fast) ease;
  }

  .shortcuts-help__item:hover {
    background: var(--theme-card-hover-bg);
  }

  .shortcuts-help__item-label {
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
    font-size: 0.8125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shortcuts-help__item-keys {
    font-size: var(--font-size-compact, 12px);
    padding: 0.25rem 0.5rem;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
        transparent
      );
    border-radius: 4px;
    color: var(--theme-accent-strong);
    font-family: ui-monospace, "SF Mono", monospace;
    white-space: nowrap;
    font-weight: 600;
    flex-shrink: 0;
  }

  .shortcuts-help__empty {
    text-align: center;
    padding: 3rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .shortcuts-help__footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--theme-stroke);
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-align: center;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .shortcuts-help {
      max-height: 95vh;
      border-radius: 14px;
    }

    .shortcuts-help__header {
      padding: 1rem;
    }

    .shortcuts-help__content {
      padding: 0.75rem;
    }

    .shortcuts-help__grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .shortcuts-help__section {
      padding: 0.75rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .shortcuts-help__close,
    .shortcuts-help__item {
      transition: none;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
