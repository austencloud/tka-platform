/**
 * Layout Manager
 *
 * Consolidates responsive layout effects into a single manager.
 * Handles layout service initialization and layout change subscriptions.
 *
 * Domain: Create module - Responsive Layout Management
 */

import type { IResponsiveLayoutManager } from "../../services/contracts/IResponsiveLayoutManager";

export interface LayoutManagerConfig {
  layoutService: IResponsiveLayoutManager;
  onLayoutChange: (shouldUseSideBySideLayout: boolean) => void;
}

/**
 * Creates layout management effects
 * @returns Cleanup function
 */
export function createLayoutEffects(config: LayoutManagerConfig): () => void {
  const { layoutService, onLayoutChange } = config;

  // Initialize layout service
  layoutService.initialize();

  // Subscribe to layout changes
  const unsubscribe = layoutService.onLayoutChange(() => {
    const shouldUseSideBySideLayout = layoutService.shouldUseSideBySideLayout();
    onLayoutChange(shouldUseSideBySideLayout);
  });

  // Initial layout calculation
  const initialLayout = layoutService.shouldUseSideBySideLayout();
  onLayoutChange(initialLayout);

  // Cleanup
  return () => {
    unsubscribe();
    layoutService.dispose();
  };
}
