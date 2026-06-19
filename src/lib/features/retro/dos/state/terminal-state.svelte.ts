/**
 * TerminalState
 *
 * Svelte 5 runes-based reactive state for the DOS terminal emulator.
 * Manages the output buffer, input line, cursor, and current mode.
 * This is a plain reactive container - mutation logic for commands,
 * boot sequence, and SCRIBE modes lives in dedicated services.
 *
 * Domain: Retro DOS Terminal
 */

import type { TerminalLine, TerminalMode, ScribeMode, DosColor } from "../domain/dos-types";

const MAX_BUFFER_LINES = 500;

class TerminalState {
	/** Output buffer - array of rendered HTML lines */
	lines = $state<TerminalLine[]>([]);

	/** Current input text (what the user is typing) */
	inputText = $state("");

	/** Whether the terminal accepts input */
	inputEnabled = $state(false);

	/** Current prompt string (e.g., "C:\\BELLWTHR>") */
	promptString = $state("C:\\BELLWTHR>");

	/** Terminal mode */
	mode = $state<TerminalMode>("boot");

	/** SCRIBE sub-mode (only relevant when mode === "scribe") */
	scribeMode = $state<ScribeMode>("menu");

	/** Terminal color scheme */
	colorScheme = $state<"green" | "amber">("green");

	/** Whether sound is enabled */
	soundEnabled = $state(true);

	/** CRT effects enabled */
	crtEffects = $state(true);

	/** When true, input characters display as asterisks (for password entry) */
	inputMask = $state(false);

	/** Display name of the authenticated user (null = not logged in) */
	authenticatedUser = $state<string | null>(null);

	/** Word passed from GENERATE command (consumed by ScribeGenerate on mount) */
	pendingWord = $state<string | null>(null);

	/**
	 * Input handler callback - set by app components to intercept user input.
	 * When set, DosTerminal routes submitted input here instead of the default
	 * command parser. The handler should set this back to null when done.
	 */
	inputHandler = $state<((input: string) => void) | null>(null);

	/**
	 * Escape handler callback - set by app components that need custom ESC behavior.
	 * When set, DosTerminal calls this on ESC instead of the default "return to menu".
	 * Used by ScribeTutorial for multi-level ESC (lesson -> index -> menu).
	 */
	escapeHandler = $state<(() => void) | null>(null);

	/** Write a line of plain text to the terminal */
	writeLine(text: string, color?: DosColor): void {
		const html = color
			? `<span class="dos-${color}">${this.escapeForDisplay(text)}</span>`
			: this.escapeForDisplay(text);
		this.lines.push({ html, timestamp: Date.now() });
		this.trimBuffer();
	}

	/**
	 * Write raw HTML to the terminal (for colored/formatted output).
	 *
	 * SECURITY CONTRACT: the `html` string is rendered verbatim via `{@html}`
	 * with NO sanitization. Callers MUST pass only internally-trusted markup —
	 * either compile-time-constant span wrappers (e.g. `dos-*` color classes)
	 * or strings whose dynamic parts have already been run through
	 * {@link escapeForDisplay}. NEVER pass raw user input or any untrusted
	 * value to this method; route user text through {@link escapeForDisplay}
	 * first, or use {@link writeLine}, which escapes for you.
	 *
	 * @param html Trusted, pre-escaped HTML. Untrusted input is an XSS vector.
	 */
	writeHtml(html: string): void {
		this.lines.push({ html, timestamp: Date.now() });
		this.trimBuffer();
	}

	/** Write an empty line */
	writeBlank(): void {
		this.lines.push({ html: "&nbsp;", timestamp: Date.now() });
		this.trimBuffer();
	}

	/** Clear the terminal buffer */
	clear(): void {
		this.lines = [];
	}

	/** Escape HTML special characters for safe display in the terminal */
	escapeForDisplay(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/ /g, "&nbsp;");
	}

	/** Trim buffer to max size, keeping the most recent lines */
	private trimBuffer(): void {
		if (this.lines.length > MAX_BUFFER_LINES) {
			this.lines = this.lines.slice(-MAX_BUFFER_LINES);
		}
	}
}

export const terminalState = new TerminalState();
