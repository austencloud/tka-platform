/**
 * Animation Shortcut Registrar Interface
 *
 * Registers and unregisters keyboard shortcuts for the animation viewer panel.
 */

import type { KeyboardShortcutManager } from '$lib/shared/keyboard/services/implementations/KeyboardShortcutManager'

export interface AnimationShortcutHandlers {
  onPlaybackToggle: () => void;
  onStepHalfBeatForward: () => void;
  onStepHalfBeatBackward: () => void;
  onStepFullBeatForward: () => void;
  onStepFullBeatBackward: () => void;
  onClose: () => void;
  onToggleBlue?: () => void;
  onToggleRed?: () => void;
  onShowHelp: () => void;
}

export interface AnimationShortcutDefinition {
  key: string;
  label: string;
  description: string;
}

export interface IAnimationShortcutRegistrar {
  /**
   * Register animation viewer keyboard shortcuts.
   * @returns Unregister function to clean up all shortcuts
   */
  register(
    service: KeyboardShortcutManager,
    handlers: AnimationShortcutHandlers
  ): () => void;

  /**
   * Shortcut definitions for display in help UI.
   */
  readonly shortcuts: readonly AnimationShortcutDefinition[];
}
