export interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  color: "blue" | "red";
}

export const DEFAULT_BROWSE_VIEW_MODE: BrowseViewMode = {
  subject: "props",
  granularity: "combined",
  color: "blue",
};
