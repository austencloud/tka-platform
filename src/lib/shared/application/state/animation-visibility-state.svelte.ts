/** Coordinates panel visibility across otherwise separate UI branches. */
let isAnyPanelOpen = $state(false);

let isSideBySideLayout = $state(false);

export function setAnyPanelOpen(open: boolean): void {
  isAnyPanelOpen = open;
}

export function setSideBySideLayout(sideBySide: boolean): void {
  isSideBySideLayout = sideBySide;
}

export function getIsAnyPanelOpen(): boolean {
  return isAnyPanelOpen;
}

export function getIsSideBySideLayout(): boolean {
  return isSideBySideLayout;
}

export function shouldHideUIForPanels(): boolean {
  return isAnyPanelOpen && isSideBySideLayout;
}

/**
 * @deprecated Use `setAnyPanelOpen`.
 */
export function setAnimationPanelOpen(open: boolean): void {
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use `setAnyPanelOpen`.
 */
export function setEditPanelOpen(open: boolean): void {
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use `setAnyPanelOpen`.
 */
export function setSharePanelOpen(open: boolean): void {
  isAnyPanelOpen = open;
}

/**
 * @deprecated Use `shouldHideUIForPanels`.
 */
export function shouldHideUIForAnimation(): boolean {
  return shouldHideUIForPanels();
}

/**
 * @deprecated Use `getIsAnyPanelOpen`.
 */
export function getIsAnimationPanelOpen(): boolean {
  return isAnyPanelOpen;
}

/**
 * @deprecated Use `getIsAnyPanelOpen`.
 */
export function getIsEditPanelOpen(): boolean {
  return isAnyPanelOpen;
}

/**
 * @deprecated Use `getIsAnyPanelOpen`.
 */
export function getIsSharePanelOpen(): boolean {
  return isAnyPanelOpen;
}
