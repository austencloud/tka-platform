import { describe, it, expect } from 'vitest';
import type { StaffMotionNotation, StaffColor } from '../domain/notation-3d';
import type { BeatNotation } from '../services/notation-pipeline';
import type { GroundTruthMotion, GroundTruthSequence } from './ground-truth';
import { scoreNotation, mirrorBeatNotation } from './scorecard';

// --- Fixtures --------------------------------------------------------------

function staff(over: Partial<StaffMotionNotation> = {}, color: StaffColor = 'blue'): StaffMotionNotation {
  return {
    staff: color,
    startLocation: 'n',
    endLocation: 'e',
    handMotion: 'shift',
    motionType: 'pro',
    rotationDirection: 'cw',
    turns: 1,
    startOrientation: 'in',
    endOrientation: 'in',
    confidence: 0.9,
    ...over,
  };
}

function beat(
  blueOver: Partial<StaffMotionNotation> = {},
  redOver: Partial<StaffMotionNotation> = {},
): BeatNotation {
  return { blue: staff(blueOver, 'blue'), red: staff(redOver, 'red') };
}

/** Full 7-field ground-truth motion straight off a detected staff. */
function truthMotion(m: StaffMotionNotation): GroundTruthMotion {
  return {
    motionType: m.motionType,
    startLocation: m.startLocation,
    endLocation: m.endLocation,
    turns: m.turns,
    rotationDirection: m.rotationDirection,
    startOrientation: m.startOrientation,
    endOrientation: m.endOrientation,
  };
}

function truthFromDetected(beats: BeatNotation[], letters?: string[]): GroundTruthSequence {
  return {
    beats: beats.map((b, i) => ({
      ...(letters?.[i] !== undefined ? { letter: letters[i] } : {}),
      blue: truthMotion(b.blue),
      red: truthMotion(b.red),
    })),
  };
}

/** A beat that shares no scored field values with the default fixture. */
function weirdBeat(): BeatNotation {
  const over: Partial<StaffMotionNotation> = {
    startLocation: 'sw',
    endLocation: 'sw',
    handMotion: 'static',
    motionType: 'static',
    rotationDirection: 'ccw',
    turns: 3,
    startOrientation: 'out',
    endOrientation: 'out',
  };
  return beat(over, over);
}

// --- Perfect and near-perfect matches -------------------------------------

describe('scoreNotation', () => {
  it('scores a perfect match at accuracy 1 with per-beat scores of 1', () => {
    const detected = [beat(), beat({ startLocation: 'e', endLocation: 's' }, { startLocation: 'w', endLocation: 's' })];
    const report = scoreNotation(detected, truthFromDetected(detected, ['A', 'B']));

    expect(report.overall.accuracy).toBe(1);
    expect(report.overall.matched).toBe(28); // 2 beats x 2 hands x 7 fields
    expect(report.overall.scored).toBe(28);
    expect(report.beats).toHaveLength(2);
    for (const b of report.beats) {
      expect(b.score).toBe(1);
      expect(b.truthIndex).not.toBeNull();
      expect(b.detectedIndex).not.toBeNull();
    }
    expect(report.beats[0]!.letter).toBe('A');
    expect(report.beats[0]!.confidence).toBe(0.9);
    expect(report.mirrored.likelyMirrored).toBe(false);
    expect(report.notes).toEqual([]);
  });

  it('localizes a single-field mismatch to the right field and hand', () => {
    const detected = [beat()]; // blue endLocation is 'e'
    const truth = truthFromDetected(detected);
    truth.beats[0]!.blue!.endLocation = 's'; // performer says south

    const report = scoreNotation(detected, truth);

    expect(report.overall.matched).toBe(13);
    expect(report.overall.scored).toBe(14);
    expect(report.perField.endLocation).toEqual({ matched: 1, scored: 2 }); // red's still matches
    expect(report.perField.startLocation).toEqual({ matched: 2, scored: 2 });

    const blueEnd = report.beats[0]!.blue!.fields.find((f) => f.field === 'endLocation')!;
    expect(blueEnd.match).toBe(false);
    expect(blueEnd.expected).toBe('s');
    expect(blueEnd.detected).toBe('e');
    const redEnd = report.beats[0]!.red!.fields.find((f) => f.field === 'endLocation')!;
    expect(redEnd.match).toBe(true);
  });
});

// --- Alignment -------------------------------------------------------------

describe('scoreNotation alignment', () => {
  const a = beat();
  const b = beat(
    { startLocation: 's', endLocation: 'w', motionType: 'anti', rotationDirection: 'ccw' },
    { startLocation: 's', endLocation: 'w', motionType: 'anti', rotationDirection: 'ccw' },
  );

  it('treats an extra detected beat as an insertion without derailing its neighbors', () => {
    const detected = [a, weirdBeat(), b];
    const report = scoreNotation(detected, truthFromDetected([a, b]));

    expect(report.beats).toHaveLength(3);
    expect(report.beats[0]).toMatchObject({ truthIndex: 0, detectedIndex: 0, score: 1 });
    expect(report.beats[1]).toMatchObject({
      truthIndex: null,
      detectedIndex: 1,
      blue: null,
      red: null,
      score: 0,
    });
    expect(report.beats[1]!.confidence).toBe(0.9); // insertions keep the detected confidence
    expect(report.beats[2]).toMatchObject({ truthIndex: 1, detectedIndex: 2, score: 1 });

    // Insertions don't dilute field accuracy — the aligned pairs are perfect.
    expect(report.overall.accuracy).toBe(1);
    expect(report.detectedBeatCount).toBe(3);
    expect(report.truthBeatCount).toBe(2);
    expect(report.notes).toContain('detected 3 beats, ground truth 2');
  });

  it('treats a never-detected ground-truth beat as a deletion', () => {
    const detected = [a, b];
    const truth = truthFromDetected([a, weirdBeat(), b], ['A', 'M', 'B']);
    const report = scoreNotation(detected, truth);

    expect(report.beats).toHaveLength(3);
    expect(report.beats[0]).toMatchObject({ truthIndex: 0, detectedIndex: 0, score: 1 });
    expect(report.beats[1]).toMatchObject({
      truthIndex: 1,
      detectedIndex: null,
      blue: null,
      red: null,
      score: 0,
      confidence: null,
      letter: 'M',
    });
    expect(report.beats[2]).toMatchObject({ truthIndex: 2, detectedIndex: 1, score: 1 });
    expect(report.notes).toContain('detected 2 beats, ground truth 3');
  });
});

// --- Field semantics ---------------------------------------------------------

describe('scoreNotation field semantics', () => {
  it("matches ground-truth 'fl' turns against a detected float, and only a float", () => {
    const detected = [beat({ motionType: 'float', turns: 0, rotationDirection: 'noRotation' })];
    const truth: GroundTruthSequence = {
      beats: [{ blue: { turns: 'fl' }, red: { turns: 'fl' } }],
    };
    const report = scoreNotation(detected, truth);

    const blueTurns = report.beats[0]!.blue!.fields.find((f) => f.field === 'turns')!;
    expect(blueTurns).toMatchObject({ expected: 'fl', detected: 'fl', match: true });

    // Red is still a pro with 1 turn — 'fl' must NOT match it.
    const redTurns = report.beats[0]!.red!.fields.find((f) => f.field === 'turns')!;
    expect(redTurns).toMatchObject({ expected: 'fl', detected: 1, match: false });
  });

  it('compares numeric turns on the quarter-turn lattice', () => {
    const detected = [beat({ turns: 1.501 }, { turns: 0.5 })];
    const truth: GroundTruthSequence = {
      beats: [{ blue: { turns: 1.5 }, red: { turns: 1 } }],
    };
    const report = scoreNotation(detected, truth);
    expect(report.beats[0]!.blue!.fields[0]!.match).toBe(true); // 1.501 rounds to 1.5
    expect(report.beats[0]!.red!.fields[0]!.match).toBe(false); // 0.5 vs 1
  });

  it('scores only the fields the ground truth supplies', () => {
    const detected = [beat()];
    const truth: GroundTruthSequence = {
      beats: [
        {
          blue: { startLocation: 'n', endLocation: 'e' },
          red: { startLocation: 'n', endLocation: 'e' },
        },
      ],
    };
    const report = scoreNotation(detected, truth);

    expect(report.overall).toEqual({ matched: 4, scored: 4, accuracy: 1 });
    expect(report.perField.startLocation).toEqual({ matched: 2, scored: 2 });
    expect(report.perField.motionType).toEqual({ matched: 0, scored: 0 });
    expect(report.perField.turns).toEqual({ matched: 0, scored: 0 });
    expect(report.beats[0]!.blue!.scored).toBe(2);
  });

  it('notes low-confidence detected beats', () => {
    const detected = [beat({ confidence: 0.3 })];
    const report = scoreNotation(detected, truthFromDetected(detected));
    expect(report.notes.some((n) => /low-confidence/.test(n) && /#0/.test(n))).toBe(true);
    expect(report.beats[0]!.confidence).toBe(0.3); // min(blue 0.3, red 0.9)
  });
});

// --- Mirror hypothesis ----------------------------------------------------------

describe('mirrorBeatNotation', () => {
  it('flips east/west locations, clock/counter, and cw/ccw — nothing else', () => {
    const original = beat(
      {
        startLocation: 'e',
        endLocation: 'ne',
        rotationDirection: 'cw',
        startOrientation: 'clock',
        endOrientation: 'in',
        motionType: 'pro',
        turns: 1.5,
      },
      {
        startLocation: 'n',
        endLocation: 's',
        rotationDirection: 'noRotation',
        startOrientation: 'out',
        endOrientation: 'counter',
        handMotion: 'dash',
        motionType: 'dash',
        turns: 0,
      },
    );
    const mirrored = mirrorBeatNotation(original);

    expect(mirrored.blue).toMatchObject({
      startLocation: 'w',
      endLocation: 'nw',
      rotationDirection: 'ccw',
      startOrientation: 'counter',
      endOrientation: 'in', // radial orientations are mirror-invariant
      motionType: 'pro', // mirroring preserves the with/against relationship
      turns: 1.5,
    });
    expect(mirrored.red).toMatchObject({
      startLocation: 'n', // on the mirror axis
      endLocation: 's',
      rotationDirection: 'noRotation',
      startOrientation: 'out',
      endOrientation: 'clock',
      handMotion: 'dash',
    });

    // Pure: the input beat is untouched.
    expect(original.blue.startLocation).toBe('e');
    expect(original.red.endOrientation).toBe('counter');
  });
});

describe('scoreNotation mirror detection', () => {
  it('flags a detection that is a left/right mirror of the truth', () => {
    // What the performer actually did (the ground truth)...
    const performed = [
      beat(
        { startLocation: 'e', endLocation: 'ne', rotationDirection: 'cw', startOrientation: 'clock', endOrientation: 'counter' },
        { startLocation: 'w', endLocation: 'sw', motionType: 'anti', rotationDirection: 'ccw', startOrientation: 'counter', endOrientation: 'in', turns: 0.5 },
      ),
      beat(
        { startLocation: 'ne', endLocation: 'se', rotationDirection: 'cw', startOrientation: 'clock' },
        { startLocation: 'sw', endLocation: 'nw', motionType: 'anti', rotationDirection: 'ccw', startOrientation: 'counter' },
      ),
    ];
    // ...and what a mirroring camera reported.
    const detected = performed.map(mirrorBeatNotation);

    const report = scoreNotation(detected, truthFromDetected(performed));

    expect(report.mirrored.accuracy).toBe(1);
    expect(report.overall.accuracy).toBeLessThan(0.85);
    expect(report.mirrored.likelyMirrored).toBe(true);
    expect(report.notes.some((n) => /mirror/i.test(n))).toBe(true);
  });

  it('does not cry mirror on an honest perfect detection', () => {
    const detected = [beat(), beat({ startLocation: 'e', endLocation: 's' })];
    const report = scoreNotation(detected, truthFromDetected(detected));
    expect(report.mirrored.likelyMirrored).toBe(false);
  });
});
