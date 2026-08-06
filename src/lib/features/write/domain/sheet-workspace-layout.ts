export interface SheetWorkspaceLayoutInput {
  zoom: number;
  pageCount: number;
  stageWidth: number;
  stageHeight: number;
  pageAspectRatio: number;
  rootFontSize: number;
}

export function shouldStackSheetWorkspace(
  workspaceWidth: number,
  workspaceHeight: number
): boolean {
  if (workspaceWidth <= 0) return false;
  if (workspaceWidth <= 640) return true;
  if (workspaceHeight > 0 && workspaceHeight < 600) return false;
  return workspaceWidth <= 900;
}

export function shouldUseTwoUpSheetLayout(
  input: SheetWorkspaceLayoutInput
): boolean {
  const {
    zoom,
    pageCount,
    stageWidth,
    stageHeight,
    pageAspectRatio,
    rootFontSize,
  } = input;
  if (zoom !== 1 || pageCount < 2 || stageWidth <= 0 || stageHeight <= 0)
    return false;
  const fitHeightWidth = (stageHeight - 6 * rootFontSize) * pageAspectRatio;
  const halfWidth = (stageWidth - 4.5 * rootFontSize - 2 * rootFontSize) / 2;
  return (
    halfWidth >= 640 && stageWidth - 4.5 * rootFontSize > fitHeightWidth * 1.35
  );
}
