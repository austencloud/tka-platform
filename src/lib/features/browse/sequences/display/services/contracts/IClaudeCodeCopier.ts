/**
 * IClaudeCodeCopier - Copy sequence data formatted for AI analysis
 *
 * Generates comprehensive sequence prompts for Claude Code agents,
 * including metadata, step data, and full JSON structure.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface CopyResult {
  success: boolean;
  error?: Error;
}

export interface IClaudeCodeCopier {
  /**
   * Copy sequence data to clipboard formatted for Claude Code
   * Loads full sequence data if steps are missing
   *
   * @param sequence - The sequence to format and copy
   * @returns Success/failure result
   */
  copyForClaude(sequence: SequenceData): Promise<CopyResult>;

  /**
   * Generate the formatted prompt text without copying
   * Useful for testing or custom handling
   */
  generatePrompt(sequence: SequenceData): Promise<string>;
}
