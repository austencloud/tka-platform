import { samplePerformerPerformance } from "./stage-performance-sampler";
import type {
  Formation,
  Mark,
  Performer,
  StageChoreography,
} from "./stage-types";

type SamplingChoreography = Pick<
  StageChoreography,
  "bpm" | "stageWidth" | "stageDepth"
>;

function arrivalBeats(performer: Performer): number[] {
  const beats = [0];
  let arrivalBeat = 0;
  for (let index = 1; index < performer.marks.length; index += 1) {
    arrivalBeat += performer.marks[index]!.beats;
    beats.push(arrivalBeat);
  }
  return beats;
}

function activeMarkAtArrival(
  performer: Performer,
  beat: number
): Mark | undefined {
  const first = performer.marks[0];
  if (!first || beat <= 0) return first;

  let arrivalBeat = 0;
  for (let index = 1; index < performer.marks.length; index += 1) {
    const mark = performer.marks[index]!;
    arrivalBeat += mark.beats;
    if (beat <= arrivalBeat) return mark;
  }
  return performer.marks.at(-1);
}

export function marksToFormations(
  performers: Performer[],
  choreography: SamplingChoreography
): Formation[] {
  const formationBeats = [
    ...new Set(performers.flatMap((performer) => arrivalBeats(performer))),
  ].sort((a, b) => a - b);

  return formationBeats.map((atBeat, index) => {
    const previousBeat = formationBeats[index - 1] ?? atBeat;
    const spots: Formation["spots"] = {};

    for (const performer of performers) {
      const frame = samplePerformerPerformance(performer, choreography, atBeat);
      const activeMark = activeMarkAtArrival(performer, atBeat);
      spots[performer.id] = {
        x: frame.stagePosition.x,
        z: frame.stagePosition.z,
        facingAngle: frame.bodyFacing,
        walkStyle: activeMark?.walkStyle ?? "direct",
        easing: activeMark?.easing ?? "linear",
      };
    }

    return {
      id: `migrated-formation-${atBeat}`,
      atBeat,
      transitionBeats:
        index === 0 ? 0 : Math.min(atBeat - previousBeat, atBeat),
      spots,
    };
  });
}
