import type { SheetHeader } from "./types/choreo-sheet";

export interface SheetTitleBlock {
  title: string;
  choreographyLine: string;
  songLine: string;
  createdLine: string;
  tagline: string;
  date: string;
  runningTitle: string;
}

export function formatSheetRunningTimestamp(timestamp: string): string {
  const value = timestamp.trim();
  return value ? `page starts ${value}` : "";
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** The preview and PDF consume these exact lines so blank metadata keeps its
 * line box without one surface inventing placeholder copy. */
export function formatSheetTitleBlock(
  sheetName: string,
  header: SheetHeader
): SheetTitleBlock {
  const title = clean(sheetName) || "Untitled Sheet";
  const choreographer = clean(header.choreographer);
  const song = clean(header.songName);
  const artist = clean(header.songArtist);

  return {
    title,
    choreographyLine: choreographer ? `Choreography by ${choreographer}` : "",
    songLine:
      song && artist
        ? `“${song}” by ${artist}`
        : artist
          ? `Song by ${artist}`
          : song
            ? `Song: ${song}`
            : "",
    createdLine: "Created using The Kinetic Alphabet",
    tagline: clean(header.tagline),
    date: clean(header.date),
    runningTitle: song || title,
  };
}
