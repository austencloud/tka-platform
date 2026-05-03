/**
 * FileNameConverter - DOS 8.3 filename conversion
 *
 * Converts human-readable sequence names into the 8.3 filename
 * format used by TKA-OS's FAT16 filesystem. Mimics the behavior
 * of Windows 95's VFAT long-filename-to-short-name algorithm.
 *
 * Domain: Retro File Manager
 */

export class FileNameConverter {
	convert(
		name: string,
		extension: string = ".SEQ",
		siblings: string[] = [],
	): string {
		/* Strip everything except A-Z and 0-9, then uppercase */
		const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, "");

		if (clean.length === 0) {
			return `UNTITLED${extension}`;
		}

		const ext = extension.toUpperCase();

		/* If it fits in 8 chars and no collision, use it directly */
		if (clean.length <= 8) {
			const candidate = `${clean}${ext}`;
			if (!siblings.includes(candidate)) {
				return candidate;
			}
		}

		/* Truncate to 8 characters */
		const base8 = clean.slice(0, 8);
		const directCandidate = `${base8}${ext}`;

		if (!siblings.includes(directCandidate)) {
			return directCandidate;
		}

		/* Collision detected - apply ~N suffix */
		for (let n = 1; n <= 99; n++) {
			const suffix = `~${n}`;
			const maxBase = 8 - suffix.length;
			const truncated = clean.slice(0, maxBase);
			const candidate = `${truncated}${suffix}${ext}`;

			if (!siblings.includes(candidate)) {
				return candidate;
			}
		}

		/* Extremely unlikely: 99 collisions exhausted */
		return `${clean.slice(0, 6)}~0${ext}`;
	}
}
