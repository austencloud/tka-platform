import {
  activateEscapeShortcutTarget,
  hasEscapeShortcutTarget,
  shouldDeferEscapeShortcut,
} from "../domain/escape-shortcut-target";
import { getEscapeLayerManager } from "../get-escape-layer-manager";
import type { KeyboardShortcutManager } from "../services/keyboard-shortcut-manager";
import type { IEscapeLayerManager } from "../services/contracts/IEscapeLayerManager";

export function registerEscapeShortcut(
  service: KeyboardShortcutManager,
  escapeLayers: IEscapeLayerManager = getEscapeLayerManager()
): void {
  service.register({
    id: "global.escape",
    label: "Close or cancel",
    description: "Close the active layer or cancel the current view",
    key: "Escape",
    modifiers: [],
    context: "global",
    scope: "navigation",
    priority: "critical",
    stopPropagation: true,
    preserveDrawers: true,
    condition: () =>
      !shouldDeferEscapeShortcut() &&
      (escapeLayers.hasLayer() || hasEscapeShortcutTarget()),
    action: () => {
      const layerResult = escapeLayers.dismissTopLayer();
      if (layerResult === "unhandled") {
        activateEscapeShortcutTarget();
      }
    },
  });
}
