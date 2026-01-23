/**
 * ClaudeCodeCopier - Copy sequence data formatted for AI analysis
 *
 * Generates comprehensive sequence prompts for Claude Code agents,
 * including metadata, database location, beat data, and full JSON.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IClaudeCodeCopier, CopyResult } from "../contracts/IClaudeCodeCopier";
import type { ISequenceDetailLoader } from "../contracts/ISequenceDetailLoader";

export class ClaudeCodeCopier implements IClaudeCodeCopier {
  constructor(private readonly detailLoader: ISequenceDetailLoader) {}

  async copyForClaude(sequence: SequenceData): Promise<CopyResult> {
    try {
      const text = await this.generatePrompt(sequence);
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      console.error("[ClaudeCodeCopier] Failed to copy sequence:", error);
      return { success: false, error: error as Error };
    }
  }

  async generatePrompt(sequence: SequenceData): Promise<string> {
    // Load full sequence data if steps are missing
    let fullSequence = sequence;
    if (this.detailLoader.needsFullLoad(sequence)) {
      const loaded = await this.detailLoader.loadFullSequence(sequence);
      if (loaded) {
        fullSequence = loaded;
      }
    }

    // Build comprehensive sequence context
    const stepCount = fullSequence.steps?.length ?? 0;
    const difficultyText =
      fullSequence.difficultyLevel ||
      fullSequence.level?.toString() ||
      "Unknown";
    const tagsText = fullSequence.tags?.length
      ? fullSequence.tags.join(", ")
      : "None";

    // Format beat data compactly
    const beatSummary = this.formatBeatSummary(fullSequence);

    // Derive starting position from first beat
    const startPosText = this.formatStartingPosition(fullSequence);

    // Build the prompt
    return `Analyze sequence ID: ${fullSequence.id}

**${fullSequence.word || fullSequence.name || "Untitled"}**
Difficulty: ${difficultyText} | Length: ${stepCount} steps | LOOP Type: ${fullSequence.loopType || "Unknown"}
Tags: ${tagsText}
Owner: ${fullSequence.ownerDisplayName || fullSequence.author || "Unknown"} (${fullSequence.ownerId || "no-id"})

---
**Database Location:**
- Collection: \`sequences\` (public) or \`users/{ownerId}/library\` (private)
- Document ID: \`${fullSequence.id}\`
- Owner ID: \`${fullSequence.ownerId || "unknown"}\`

**Starting Position (derived from beat 1):**
${startPosText}

**Beat Sequence:**
${beatSummary}

---
**Full Sequence JSON:**
\`\`\`json
${JSON.stringify(fullSequence, null, 2)}
\`\`\`

---
Use this data to investigate issues, analyze the sequence structure, or make modifications. The sequence is stored in Firebase Firestore.`;
  }

  private formatBeatSummary(sequence: SequenceData): string {
    if (!sequence.steps?.length) {
      return "  No beat data available";
    }

    return sequence.steps
      .map((beat, i) => {
        const blueMotion = beat.motions?.blue;
        const redMotion = beat.motions?.red;
        const blueInfo = blueMotion
          ? `${blueMotion.motionType} ${blueMotion.startLocation}->${blueMotion.endLocation}`
          : "none";
        const redInfo = redMotion
          ? `${redMotion.motionType} ${redMotion.startLocation}->${redMotion.endLocation}`
          : "none";
        return `  Beat ${i + 1}: Blue(${blueInfo}) Red(${redInfo})`;
      })
      .join("\n");
  }

  private formatStartingPosition(sequence: SequenceData): string {
    const firstStep = sequence.steps?.[0];
    if (!firstStep) {
      return "No steps to derive from";
    }

    const blueStart = firstStep.motions?.blue;
    const redStart = firstStep.motions?.red;

    return `Blue: ${blueStart?.startLocation || "?"} (${blueStart?.startOrientation || "?"}), Red: ${redStart?.startLocation || "?"} (${redStart?.startOrientation || "?"})`;
  }
}
