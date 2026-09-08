export type TunnelWorkspaceMode =
  | "stack"
  | "portrait"
  | "short-landscape"
  | "split";

export interface TunnelWorkspaceSize {
  width: number;
  height: number;
}

/**
 * Resolve the Tunnel workspace from the room the Create slot actually owns.
 *
 * The thresholds describe capabilities, not devices:
 * - a short landscape slot can sustain two lean columns but not desktop chrome;
 * - a portrait tablet can sustain both jobs only when they use the full width;
 * - the ordinary split waits until both columns remain useful;
 * - everything else scrolls as one honest column.
 *
 * Keeping this decision in one owner prevents markup and CSS from landing on
 * opposite sides of a breakpoint, the same measured-layout discipline Fuse
 * uses for compact, portrait, landscape, and full-card workspaces.
 */
export function resolveTunnelWorkspaceMode({
  width,
  height,
}: TunnelWorkspaceSize): TunnelWorkspaceMode {
  // Two short-landscape tracks need enough room for the choreography controls
  // and the stage controls without either side enforcing its min-content width
  // on the other. Below this threshold an honest vertical stack also provides
  // the expected 200% browser-zoom reflow for a 1440px desktop viewport.
  if (width >= 840 && width > height && height <= 540) {
    return "short-landscape";
  }
  if (width >= 1000) return "split";
  if (width >= 720 && height >= 700) return "portrait";
  return "stack";
}

export function canInlineTunnelInspector(size: TunnelWorkspaceSize): boolean {
  return resolveTunnelWorkspaceMode(size) === "split" && size.height >= 700;
}
