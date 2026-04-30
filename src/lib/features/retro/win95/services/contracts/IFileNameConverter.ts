/**
 * IFileNameConverter - Contract for DOS 8.3 filename conversion
 *
 * Converts human-readable sequence names into the 8.3 filename
 * format used by TKA-OS's FAT16 filesystem. Strips illegal
 * characters, truncates, and appends tilde-numeric suffixes
 * when collisions are detected.
 *
 * Domain: Retro File Manager
 */

export interface IFileNameConverter {
	/**
	 * Convert a human-readable name to 8.3 DOS format.
	 *
	 * Rules:
	 * - Uppercase all characters
	 * - Strip spaces and special characters (keep A-Z, 0-9)
	 * - Truncate to 8 characters for the base name
	 * - Append the given extension (default ".SEQ")
	 * - If `siblings` contains a collision, append ~N suffix
	 *
	 * @param name - The human-readable sequence name
	 * @param extension - File extension including dot (default ".SEQ")
	 * @param siblings - Existing filenames to check for collisions
	 * @returns The 8.3 formatted filename
	 */
	convert(name: string, extension?: string, siblings?: string[]): string;
}
