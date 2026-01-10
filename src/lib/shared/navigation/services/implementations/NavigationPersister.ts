/**
 * NavigationPersister
 *
 * Implementation of INavigationPersister.
 * Handles all localStorage/sessionStorage operations for navigation state.
 */

import type { INavigationPersister } from "../contracts/INavigationPersister";
import type { ModuleId } from "../../domain/types";
import { MODULE_DEFINITIONS } from "../../config/module-definitions";
import {
  CURRENT_MODULE_KEY,
  ACTIVE_TAB_KEY,
  MODULE_LAST_TABS_KEY,
  TAB_LAST_PANELS_KEY,
  CURRENT_CREATE_MODE_KEY,
  CURRENT_LEARN_MODE_KEY,
  PREVIOUS_MODULE_SESSION_KEY,
} from "../../config/storage-keys";

export class NavigationPersister implements INavigationPersister {
  // ─────────────────────────────────────────────────────────────────────────────
  // Module Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  loadCurrentModule(): ModuleId | null {
    if (typeof localStorage === "undefined") return null;

    const saved = localStorage.getItem(CURRENT_MODULE_KEY);
    if (!saved) return null;

    // Handle migration for retired modules
    if (saved === "community" || saved === "account") {
      this.saveCurrentModule("dashboard");
      return "dashboard";
    }

    // Validate against current module definitions
    if (MODULE_DEFINITIONS.some((m) => m.id === saved)) {
      return saved as ModuleId;
    }

    return null;
  }

  saveCurrentModule(moduleId: ModuleId): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CURRENT_MODULE_KEY, moduleId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Active Tab Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  loadActiveTab(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(ACTIVE_TAB_KEY);
  }

  saveActiveTab(tabId: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Last Tab Per Module Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  loadLastTabByModule(): Partial<Record<ModuleId, string>> {
    if (typeof localStorage === "undefined") return {};

    const saved = localStorage.getItem(MODULE_LAST_TABS_KEY);
    if (!saved) return {};

    try {
      const parsed = JSON.parse(saved) as Record<string, string>;

      // Validate each entry against module definitions
      const validEntries = Object.entries(parsed).filter(
        ([moduleId, tabId]) => {
          const moduleDef = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
          return moduleDef?.sections.some((tab) => tab.id === tabId) ?? false;
        }
      );

      return Object.fromEntries(validEntries) as Partial<
        Record<ModuleId, string>
      >;
    } catch (error) {
      console.warn(
        "NavigationPersister: failed to parse module tab map:",
        error
      );
      return {};
    }
  }

  saveLastTabByModule(lastTabs: Partial<Record<ModuleId, string>>): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(MODULE_LAST_TABS_KEY, JSON.stringify(lastTabs));
    } catch (error) {
      console.warn(
        "NavigationPersister: failed to persist module tab map:",
        error
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Panel Per Tab Persistence
  // ─────────────────────────────────────────────────────────────────────────────

  loadLastPanelByTab(): Record<string, string | null> {
    if (typeof localStorage === "undefined") return {};

    const saved = localStorage.getItem(TAB_LAST_PANELS_KEY);
    if (!saved) return {};

    try {
      const parsed = JSON.parse(saved) as Record<string, string | null>;

      // Validate tab keys (format: "moduleId:tabId")
      const validEntries = Object.entries(parsed).filter(([tabKey]) => {
        const [moduleId, tabId] = tabKey.split(":");
        if (!moduleId || !tabId) return false;
        const moduleDef = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
        return moduleDef?.sections.some((tab) => tab.id === tabId) ?? false;
      });

      return Object.fromEntries(validEntries);
    } catch (error) {
      console.warn(
        "NavigationPersister: failed to parse tab panel map:",
        error
      );
      return {};
    }
  }

  saveLastPanelByTab(lastPanels: Record<string, string | null>): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(TAB_LAST_PANELS_KEY, JSON.stringify(lastPanels));
    } catch (error) {
      console.warn(
        "NavigationPersister: failed to persist tab panel map:",
        error
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Legacy Mode Persistence (backwards compatibility)
  // ─────────────────────────────────────────────────────────────────────────────

  loadCreateMode(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(CURRENT_CREATE_MODE_KEY);
  }

  saveCreateMode(mode: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CURRENT_CREATE_MODE_KEY, mode);
  }

  loadLearnMode(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(CURRENT_LEARN_MODE_KEY);
  }

  saveLearnMode(mode: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CURRENT_LEARN_MODE_KEY, mode);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Previous Module (Session Storage)
  // ─────────────────────────────────────────────────────────────────────────────

  loadPreviousModule(): ModuleId | null {
    if (typeof sessionStorage === "undefined") return null;

    const saved = sessionStorage.getItem(PREVIOUS_MODULE_SESSION_KEY);
    if (!saved) return null;

    if (MODULE_DEFINITIONS.some((m) => m.id === saved)) {
      return saved as ModuleId;
    }

    return null;
  }

  savePreviousModule(moduleId: ModuleId | null): void {
    if (typeof sessionStorage === "undefined") return;

    if (moduleId) {
      sessionStorage.setItem(PREVIOUS_MODULE_SESSION_KEY, moduleId);
    } else {
      sessionStorage.removeItem(PREVIOUS_MODULE_SESSION_KEY);
    }
  }
}
