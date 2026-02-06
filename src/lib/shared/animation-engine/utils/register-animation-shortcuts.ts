/**
 * Register Animation Viewer Shortcuts
 *
 * Registers keyboard shortcuts for the animation viewer panel.
 * These shortcuts are only active when the animation panel is open.
 */

import type { IKeyboardShortcutManager } from "$lib/shared/keyboard/services/contracts/IKeyboardShortcutManager";

export interface AnimationShortcutHandlers {
  onPlaybackToggle: () => void;
  onStepHalfBeatForward: () => void;
  onStepHalfBeatBackward: () => void;
  onStepFullBeatForward: () => void;
  onStepFullBeatBackward: () => void;
  onClose: () => void;
  onToggleBlue: () => void;
  onToggleRed: () => void;
  onShowHelp: () => void;
}

/**
 * Register animation viewer keyboard shortcuts
 * @returns Unregister function to clean up all shortcuts
 */
export function registerAnimationShortcuts(
  service: IKeyboardShortcutManager,
  handlers: AnimationShortcutHandlers
): () => void {
  const unregisterFns: (() => void)[] = [];

  // Space - Play/Pause
  unregisterFns.push(
    service.register({
      id: "animation.play-pause",
      label: "Play / Pause",
      description: "Toggle animation playback",
      key: " ",
      modifiers: [],
      context: "animation-panel",
      scope: "animation",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onPlaybackToggle();
      },
    })
  );

  // Right Arrow - Step full beat forward (most common action)
  unregisterFns.push(
    service.register({
      id: "animation.step-forward",
      label: "Step Forward",
      description: "Move forward one full beat",
      key: "ArrowRight",
      modifiers: [],
      context: "animation-panel",
      scope: "animation",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onStepFullBeatForward();
      },
    })
  );

  // Left Arrow - Step full beat backward (most common action)
  unregisterFns.push(
    service.register({
      id: "animation.step-backward",
      label: "Step Backward",
      description: "Move backward one full beat",
      key: "ArrowLeft",
      modifiers: [],
      context: "animation-panel",
      scope: "animation",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onStepFullBeatBackward();
      },
    })
  );

  // Shift + Right Arrow - Step half beat forward (fine control)
  unregisterFns.push(
    service.register({
      id: "animation.step-half-forward",
      label: "Step Half Beat Forward",
      description: "Move forward half a beat",
      key: "ArrowRight",
      modifiers: ["shift"],
      context: "animation-panel",
      scope: "animation",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onStepHalfBeatForward();
      },
    })
  );

  // Shift + Left Arrow - Step half beat backward (fine control)
  unregisterFns.push(
    service.register({
      id: "animation.step-half-backward",
      label: "Step Half Beat Backward",
      description: "Move backward half a beat",
      key: "ArrowLeft",
      modifiers: ["shift"],
      context: "animation-panel",
      scope: "animation",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onStepHalfBeatBackward();
      },
    })
  );

  // B - Toggle blue motion visibility
  unregisterFns.push(
    service.register({
      id: "animation.toggle-blue",
      label: "Toggle Blue Motion",
      description: "Show or hide blue prop motion path",
      key: "b",
      modifiers: [],
      context: "animation-panel",
      scope: "animation",
      priority: "medium",
      action: (e) => {
        e.preventDefault();
        handlers.onToggleBlue();
      },
    })
  );

  // R - Toggle red motion visibility
  unregisterFns.push(
    service.register({
      id: "animation.toggle-red",
      label: "Toggle Red Motion",
      description: "Show or hide red prop motion path",
      key: "r",
      modifiers: [],
      context: "animation-panel",
      scope: "animation",
      priority: "medium",
      action: (e) => {
        e.preventDefault();
        handlers.onToggleRed();
      },
    })
  );

  // Escape - Close panel
  unregisterFns.push(
    service.register({
      id: "animation.close",
      label: "Close Panel",
      description: "Close the animation viewer",
      key: "Escape",
      modifiers: [],
      context: "animation-panel",
      scope: "panel",
      priority: "high",
      action: (e) => {
        e.preventDefault();
        handlers.onClose();
      },
    })
  );

  // ? - Show help
  unregisterFns.push(
    service.register({
      id: "animation.show-help",
      label: "Show Shortcuts",
      description: "Display keyboard shortcuts help",
      key: "?",
      modifiers: [],
      context: "animation-panel",
      scope: "help",
      priority: "medium",
      action: (e) => {
        e.preventDefault();
        handlers.onShowHelp();
      },
    })
  );

  // Return cleanup function
  return () => {
    unregisterFns.forEach((fn) => fn());
  };
}

/**
 * Animation viewer shortcut definitions for display in help
 */
export const ANIMATION_SHORTCUTS = [
  {
    key: "Space",
    label: "Play / Pause",
    description: "Toggle animation playback",
  },
  {
    key: "←",
    label: "Previous Beat",
    description: "Move backward one full beat",
  },
  { key: "→", label: "Next Beat", description: "Move forward one full beat" },
  {
    key: "Shift + ←",
    label: "Half Beat Back",
    description: "Move backward half a beat",
  },
  {
    key: "Shift + →",
    label: "Half Beat Forward",
    description: "Move forward half a beat",
  },
  { key: "B", label: "Toggle Blue", description: "Show/hide blue motion path" },
  { key: "R", label: "Toggle Red", description: "Show/hide red motion path" },
  { key: "Esc", label: "Close", description: "Close the animation viewer" },
  { key: "?", label: "Help", description: "Show this help panel" },
] as const;
