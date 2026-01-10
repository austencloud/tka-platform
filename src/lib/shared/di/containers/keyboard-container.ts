/**
 * Keyboard Container - ITI Dependency Injection
 *
 * Factory-based container for keyboard shortcut services.
 * All services are singletons (created once, cached).
 */

import { createContainer } from "iti";
import { ShortcutRegistry } from "../../keyboard/services/implementations/ShortcutRegistry";
import { KeyboardShortcutManager } from "../../keyboard/services/implementations/KeyboardShortcutManager";
import { CommandPalette } from "../../keyboard/services/implementations/CommandPalette";
import { ShortcutCustomizer } from "../../keyboard/services/implementations/ShortcutCustomizer";

export const keyboardContainer = createContainer()
  .add({
    shortcutRegistry: () => new ShortcutRegistry(),
  })
  .add((ctx) => ({
    keyboardShortcutManager: () =>
      new KeyboardShortcutManager(ctx.shortcutRegistry),
  }))
  .add({
    commandPalette: () => new CommandPalette(),
  })
  .add((ctx) => ({
    shortcutCustomizer: () => new ShortcutCustomizer(ctx.shortcutRegistry),
  }));

export type KeyboardContainer = typeof keyboardContainer;
