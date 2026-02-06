/**
 * Panel Visibility State
 *
 * Global state for tracking panel visibility across the app.
 * Used to coordinate UI hiding (button panel, navigation tabs) when panels are open.
 *
 * This is a lightweight global state that allows components in different parts of the tree
 * (CreateModule and MainInterface) to coordinate without prop drilling.
 *
 * Panels that hide UI: All mutually exclusive modal/slide panels
 * (Edit, Animation, Share, Filter, Sequence Actions, LOOP, Creation Method)
 */

/**
 * Global state for any panel being open
 */
let isAnyPanelOpen = $state(false);

/**
 * Global state for side-by-side layout mode
 */
let isSideBySideLayout = $state(false);

/**
 * Set whether any panel is open
 * This should be called from CreateModule when panelState.isAnyPanelOpen changes
 */
export function setAnyPanelOpen(open: boolean): void {
  isAnyPanelOpen = open;
}

/**
 * Set side-by-side layout state
 */
export function setSideBySideLayout(sideBySide: boolean): void {
  isSideBySideLayout = sideBySide;
}

/**
 * Get whether any panel is open
 */
export function getIsAnyPanelOpen(): boolean {
  return isAnyPanelOpen;
}

/**
 * Get whether layout is side-by-side
 */
export function getIsSideBySideLayout(): boolean {
  return isSideBySideLayout;
}

/**
 * Derived state: should hide UI elements (any panel open in side-by-side layout)
 * Returns true when any modal/slide panel is open in side-by-side layout
 */
export function shouldHideUIForPanels(): boolean {
  return isAnyPanelOpen && isSideBySideLayout;
}

// ============================================================================
// DEPRECATED - Legacy individual panel tracking (kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use setAnyPanelOpen() instead. Individual panel tracking is no longer needed.
 */
export function setAnimationPanelOpen(open: boolean): void {
  // Legacy compatibility - this is now handled by setAnyPanelOpen()
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use setAnyPanelOpen() instead. Individual panel tracking is no longer needed.
 */
export function setEditPanelOpen(open: boolean): void {
  // Legacy compatibility - this is now handled by setAnyPanelOpen()
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use setAnyPanelOpen() instead. Individual panel tracking is no longer needed.
 */
export function setSharePanelOpen(open: boolean): void {
  // Legacy compatibility - this is now handled by setAnyPanelOpen()
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use shouldHideUIForPanels() instead
 */
export function shouldHideUIForAnimation(): boolean {
  return shouldHideUIForPanels();
}

/**
 * @deprecated Use getIsAnyPanelOpen() instead
 */
export function getIsAnimationPanelOpen(): boolean {
  return isAnyPanelOpen;
}

/**
 * @deprecated Use getIsAnyPanelOpen() instead
 */
export function getIsEditPanelOpen(): boolean {
  return isAnyPanelOpen;
}

/**
 * @deprecated Use getIsAnyPanelOpen() instead
 */
export function getIsSharePanelOpen(): boolean {
  return isAnyPanelOpen;
}
