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
  import { container } from "../../di";

  import type { IKeyboardShortcutManager } from "../services/contracts/IKeyboardShortcutManager";
  import type { ICommandPalette } from "../services/contracts/ICommandPalette";
  import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
  import { getActiveModule } from "../../application/state/ui/ui-state.svelte";
  import { registerGlobalShortcuts } from "../utils/register-global-shortcuts";
  import { registerCommandPaletteCommands } from "../utils/register-commands";
  import { registerCreateShortcuts } from "../utils/register-create-shortcuts";
  import { register3DViewerShortcuts } from "../utils/register-3d-viewer-shortcuts";

  // Services
  let shortcutManager: IKeyboardShortcutManager | null = null;
  let commandPalette: ICommandPalette | null = null;

  onMount(() => {
    // Initialize services asynchronously
    (async () => {
      try {
        // Resolve services
        shortcutManager = container.items.keyboardShortcutManager;
        commandPalette = container.items.commandPalette;

        // Initialize the shortcut manager
        shortcutManager.initialize();

        // Register global shortcuts
        registerGlobalShortcuts(shortcutManager, keyboardShortcutState);

        // Register command palette commands
        registerCommandPaletteCommands(commandPalette, keyboardShortcutState);

        // Register CREATE module shortcuts
        registerCreateShortcuts(shortcutManager, keyboardShortcutState);

        // Register 3D Viewer shortcuts (static, handlers bound dynamically)
        register3DViewerShortcuts(shortcutManager);
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
