/**
 * Format a duration in seconds as `m:ss` (e.g. 75 → "1:15").
 *
 * Shared by viewer transport, beat mapping editor, quiz timer, spotlight video,
 * and synced playback — everywhere a compact minute:second readout is needed.
 * Variants that emit milliseconds, decimals, or conditional prefixes keep their
 * local implementations.
 */
export function formatTime(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
