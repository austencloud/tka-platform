export type VideoVisibility = "public" | "private" | "collaborators-only";

export const DEFAULT_VIDEO_VISIBILITY: VideoVisibility = "private";

export const VIDEO_VISIBILITY_OPTIONS: Array<{
  value: VideoVisibility;
  label: string;
}> = [
  { value: "private", label: "Private" },
  { value: "collaborators-only", label: "Collaborators" },
  { value: "public", label: "Public" },
];

export function describeVideoVisibility(visibility: VideoVisibility): string {
  switch (visibility) {
    case "public":
      return "Visible in TKA to anyone who can open this sequence.";
    case "collaborators-only":
      return "Visible in TKA to you and accepted collaborators.";
    case "private":
      return "Visible in TKA only to you.";
  }
}
