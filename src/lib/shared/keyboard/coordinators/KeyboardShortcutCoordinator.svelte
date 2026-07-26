<script lang="ts">
  /**
   * Keyboard Shortcut Coordinator
   *
   * Initializes and coordinates the keyboard shortcut system.
   * Registers global shortcuts and manages the command palette.
   *
   * Domain: Keyboard Shortcuts - Coordination
   */

  import { onMount } from "svelte";
  import { getKeyboardShortcutManager } from "../get-keyboard-shortcut-manager";
  import { getCommandPalette } from "../get-command-palette";

  import type { KeyboardShortcutManager } from '$lib/shared/keyboard/services/keyboard-shortcut-manager'
  import type { CommandPalette } from '$lib/shared/keyboard/services/command-palette'
  import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
  import { getActiveModule } from "../../application/state/ui/ui-state.svelte";
  import { registerGlobalShortcuts } from "../registration/register-global-shortcuts";
  import { registerCommandPaletteCommands } from "../registration/register-commands";
  import { registerCreateShortcuts } from "../registration/register-create-shortcuts";
  import { register3DViewerShortcuts } from "../registration/register-3d-viewer-shortcuts";
  import { registerChoreoShortcuts } from "../registration/register-choreo-shortcuts";

  // Services
  let shortcutManager: KeyboardShortcutManager | null = null;
  let commandPalette: CommandPalette | null = null;

  onMount(() => {
    // Initialize services asynchronously
    (async () => {
      try {
        // Resolve services
        const manager = getKeyboardShortcutManager();
        const palette = getCommandPalette();

        // Assign to component variables for cleanup
        shortcutManager = manager;
        commandPalette = palette;

        // Initialize the shortcut manager
        manager.initialize();

        // Register global shortcuts
        registerGlobalShortcuts(manager, keyboardShortcutState);

        // Register command palette commands
        registerCommandPaletteCommands(palette, keyboardShortcutState);

        // Register CREATE module shortcuts
        registerCreateShortcuts(manager, keyboardShortcutState);

        // Register 3D Viewer shortcuts (static, handlers bound dynamically)
        register3DViewerShortcuts(manager);

        // Register Choreo sheet shortcuts (static, handlers bound dynamically)
        registerChoreoShortcuts(manager);
      } catch (error) {
        console.error("Failed to initialize keyboard shortcuts:", error);
      }
    })();

    // Cleanup on unmount
    return () => {
      if (shortcutManager) {
        shortcutManager.dispose();
      }
    };
  });

  // Sync context with active module
  $effect(() => {
    const module = getActiveModule();

    // Only set context if service is initialized and module is available
    if (shortcutManager && module) {
      shortcutManager.setContext(module as any);
    }
  });
</script>

<!-- This coordinator has no UI -->
