/**
 * "Share vs Download" action labelling — one source for the whole app.
 *
 * On mobile the app never "downloads" or "saves" a file to disk directly; it
 * opens the native share sheet (see `shareOrDownloadBlob` in file-downloader.ts),
 * so the user can text/AirDrop/save it wherever. The button copy must match that
 * reality: "Share" on mobile, "Download" on desktop — otherwise the label lies
 * about what tapping it does.
 *
 * This mirrors `shareOrDownloadBlob`'s exact gate (`detectPlatform() !==
 * "desktop"`) so the copy can never disagree with the behavior. It is reactive:
 * the flag recomputes on viewport changes (rotation, responsive resize), so a
 * device that crosses the desktop breakpoint relabels live.
 */
import { detectPlatform } from "./services/platform-detector";

let isMobileShareTarget = $state(
  typeof window !== "undefined" && detectPlatform() !== "desktop",
);

if (typeof window !== "undefined") {
  const update = () => {
    isMobileShareTarget = detectPlatform() !== "desktop";
  };
  window.matchMedia("(pointer: fine)").addEventListener("change", update);
  window.matchMedia("(hover: hover)").addEventListener("change", update);
  window.addEventListener("resize", update);
}

/** Reactive: true when the export path opens the native share sheet (mobile). */
export const shareTarget = {
  get isMobile(): boolean {
    return isMobileShareTarget;
  },
};

/** The bare verb for a save/export action on this device. */
export function saveActionVerb(): "Share" | "Download" {
  return isMobileShareTarget ? "Share" : "Download";
}

/**
 * A save/export action label. `noun` names what's produced ("PNG", "Video",
 * "Card"): "Share PNG" on mobile, "Download PNG" on desktop. Omit `noun` for a
 * bare "Share" / "Download".
 */
export function saveActionLabel(noun?: string): string {
  const verb = saveActionVerb();
  return noun ? `${verb} ${noun}` : verb;
}
