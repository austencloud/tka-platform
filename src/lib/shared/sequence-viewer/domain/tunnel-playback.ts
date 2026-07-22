export type TunnelPlaybackSource = "canvas" | "sidebar";

export type TunnelPlaybackSink = (
  previousValue: boolean,
  value: boolean,
  source: TunnelPlaybackSource
) => void;

/** One tunnel clock, regardless of which control toggled it. */
export function toggleTunnelPlayback(
  current: boolean,
  source: TunnelPlaybackSource,
  sink?: TunnelPlaybackSink
): boolean {
  const next = !current;
  sink?.(current, next, source);
  return next;
}
