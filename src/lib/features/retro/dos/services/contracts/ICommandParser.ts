/**
 * ICommandParser -- Contract for the DOS command interpreter
 *
 * Tokenizes raw input strings and dispatches to the appropriate handler:
 * built-in DOS commands (DIR, TYPE, CD, CLS, VER, HELP), SCRIBE launcher,
 * shortcut commands (GENERATE, SPELL), and the REGISTER easter egg.
 * Unrecognized input produces the canonical "Bad command or file name" error.
 *
 * Input is case-insensitive - the parser uppercases before matching.
 *
 * Domain: Retro DOS Era
 */

export interface ICommandParser {
	/**
	 * Parse and execute a command string.
	 *
	 * Writes all output directly to the terminal state. Returns void because
	 * all side effects (terminal output, mode transitions) happen synchronously
	 * through the injected terminal state and filesystem references.
	 */
	execute(input: string): void;
}
