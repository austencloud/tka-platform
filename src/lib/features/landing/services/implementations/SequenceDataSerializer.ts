import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { GenerationSettings } from "../../domain/models/spinner-models";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceDataSerializer {
  toCompactDebug(sequence: SequenceData, settings?: GenerationSettings | null): string {
    const sections: Record<string, unknown> = {};

    sections.word = sequence.word;
    sections.gridMode = sequence.gridMode ?? "unknown";
    sections.isCircular = sequence.isCircular;

    if (sequence.loopType) {
      sections.loopType = sequence.loopType;
    }
    if (sequence.orientationCycleCount) {
      sections.orientationCycleCount = sequence.orientationCycleCount;
    }

    if (settings) {
      sections.generationSettings = {
        loopType: settings.loopType,
        period: settings.period,
        difficulty: settings.difficulty,
        turnIntensity: settings.turnIntensity,
        baseLength: settings.baseLength,
        totalSteps: settings.totalSteps,
      };
    }

    if (sequence.startPosition) {
      sections.startPosition = {
        letter: sequence.startPosition.letter,
        endPosition: sequence.startPosition.endPosition,
      };
    }

    sections.steps = sequence.steps.map((step) => this.compactStep(step));

    return JSON.stringify(sections, null, 2);
  }

  toFullJson(sequence: SequenceData, settings?: GenerationSettings | null): string {
    const output: Record<string, unknown> = {
      ...sequence,
      ...(settings ? { generationSettings: settings } : {}),
    };
    return JSON.stringify(output, null, 2);
  }

  private compactStep(step: StepData): Record<string, unknown> {
    const blue = step.motions?.[MotionColor.BLUE];
    const red = step.motions?.[MotionColor.RED];

    return {
      beat: step.stepNumber,
      letter: step.letter,
      blue: blue
        ? {
            type: blue.motionType,
            start: blue.startLocation,
            end: blue.endLocation,
            turns: blue.turns,
            startOri: blue.startOrientation,
            endOri: blue.endOrientation,
          }
        : null,
      red: red
        ? {
            type: red.motionType,
            start: red.startLocation,
            end: red.endLocation,
            turns: red.turns,
            startOri: red.startOrientation,
            endOri: red.endOrientation,
          }
        : null,
    };
  }
}
