/**
 * DarkModeProvider - DI wrapper for reactive Dark Mode state
 *
 * Wraps the AnimationVisibilityStateManager singleton to provide:
 * 1. Clean DI interface for dependency injection
 * 2. Proper subscription pattern (vs polling)
 * 3. Type-safe access to Dark Mode state
 */

import { getAnimationVisibilityManager } from "../state/animation-visibility-state.svelte";

export class DarkModeProvider {
  private manager = getAnimationVisibilityManager();
  private subscribers = new Map<(darkMode: boolean) => void, () => void>();

  isDarkMode(): boolean {
    return this.manager.isDarkMode();
  }

  subscribe(callback: (darkMode: boolean) => void): () => void {
    // Create an observer that calls our callback with current value
    const observer = () => {
      callback(this.manager.isDarkMode());
    };

    this.manager.registerObserver(observer);

    // Store for cleanup
    this.subscribers.set(callback, () => {
      this.manager.unregisterObserver(observer);
    });

    // Immediately call with current value
    callback(this.manager.isDarkMode());

    // Return unsubscribe function
    return () => {
      const unsubscribe = this.subscribers.get(callback);
      if (unsubscribe) {
        unsubscribe();
        this.subscribers.delete(callback);
      }
    };
  }

  setDarkMode(value: boolean): void {
    this.manager.setDarkMode(value);
  }
}
