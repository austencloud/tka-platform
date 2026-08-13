/**
 * One prop sprite exactly as it was painted by the animation renderer.
 *
 * Effects that interact with the visible prop use this snapshot instead of
 * rebuilding its pose from domain state. That keeps hot-swap crossfades,
 * asymmetric flips, and tunnel copies aligned with the pixels the user sees.
 */
export interface RenderedPropSprite {
  image: TexImageSource;
  centerX: number;
  centerY: number;
  angle: number;
  width: number;
  height: number;
  flipped: boolean;
  opacity: number;
}
