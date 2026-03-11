/**
 * SequenceContentHasher - Computes a deterministic SHA-256 hash from motion content
 *
 * The hash is the sequence's identity as a physical movement pattern.
 * Same hash = same variation. Different hash = different variation.
 *
 * Only motion-defining fields contribute to the hash. Everything that's a user
 * annotation (name, tags, visibility, thumbnails) is excluded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { ISequenceContentHasher } from "../contracts/ISequenceContentHasher";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceContentHasher implements ISequenceContentHasher {
  async computeHash(sequence: SequenceData): Promise<string> {
    const content = this.extractContent(sequence);
    const json = JSON.stringify(content);
    const buffer = new TextEncoder().encode(json);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private extractContent(sequence: SequenceData): unknown {
    return {
      gridMode: sequence.gridMode ?? null,
      startPosition: this.extractStartPosition(
        sequence.startPosition ?? sequence.startingPosition
      ),
      steps: sequence.steps.map((step) => this.extractStep(step)),
    };
  }

  private extractStartPosition(
    sp: StartPositionData | undefined
  ): unknown {
    if (!sp) return null;
    return {
      motions: this.extractMotions(sp.motions),
      gridMode: sp.gridMode ?? null,
    };
  }

  private extractStep(step: StepData): unknown {
    return {
      letter: step.letter ?? null,
      blueReversal: step.blueReversal,
      redReversal: step.redReversal,
      isBlank: step.isBlank,
      duration: step.duration,
      motions: this.extractMotions(step.motions),
      gridMode: step.gridMode ?? null,
    };
  }

  private extractMotions(
    motions: Partial<Record<MotionColor, MotionData | undefined>>
  ): unknown {
    // Sort by color key for determinism (BLUE before RED alphabetically)
    const sorted = [MotionColor.BLUE, MotionColor.RED]
      .filter((color) => motions[color])
      .map((color) => [color, this.extractMotion(motions[color]!)]);
    return Object.fromEntries(sorted);
  }

  private extractMotion(m: MotionData): unknown {
    return {
      motionType: m.motionType,
      rotationDirection: m.rotationDirection,
      startLocation: m.startLocation,
      endLocation: m.endLocation,
      turns: m.turns,
      startOrientation: m.startOrientation,
      endOrientation: m.endOrientation,
      handPath: m.handPath ?? null,
      gridMode: m.gridMode,
      skewSteps: m.skewSteps ?? null,
      skewDir: m.skewDir ?? null,
    };
  }
}
