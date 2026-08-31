import { describe, it, expect } from 'vitest';
import { parseGroundTruth } from './ground-truth';

describe('parseGroundTruth shapes', () => {
  it('parses the harness-native { word, beats } shape', () => {
    const parsed = parseGroundTruth(
      JSON.stringify({
        word: 'AB',
        beats: [
          {
            letter: 'A',
            left: { motionType: 'pro', startLocation: 'n', endLocation: 'e', turns: 1 },
            right: { motionType: 'anti', startLocation: 's', endLocation: 'w' },
          },
          { letter: 'B', left: { startLocation: 'e', endLocation: 's' } },
        ],
      }),
    );
    expect(parsed.word).toBe('AB');
    expect(parsed.beats).toHaveLength(2);
    expect(parsed.beats[0]!.letter).toBe('A');
    expect(parsed.beats[0]!.left).toEqual({
      motionType: 'pro',
      startLocation: 'n',
      endLocation: 'e',
      turns: 1,
    });
    expect(parsed.beats[0]!.right!.motionType).toBe('anti');
    expect(parsed.beats[1]!.right).toBeUndefined();
  });

  it('parses the app sequence-data { steps: [{ motions }] } shape and ignores extra fields', () => {
    const parsed = parseGroundTruth(
      JSON.stringify({
        word: 'C',
        steps: [
          {
            letter: 'C',
            motions: {
              left: {
                motionType: 'pro',
                startLocation: 'n',
                endLocation: 'e',
                turns: 0.5,
                rotationDirection: 'cw',
                startOrientation: 'in',
                endOrientation: 'out',
                // render-only baggage that must be ignored, not rejected
                isVisible: true,
                propType: 'staff',
                arrowLocation: 'ne',
                gridMode: 'diamond',
              },
              right: { startLocation: 's', endLocation: 'w', isVisible: false },
            },
          },
        ],
      }),
    );
    expect(parsed.word).toBe('C');
    expect(parsed.beats).toHaveLength(1);
    expect(parsed.beats[0]!.left).toEqual({
      motionType: 'pro',
      startLocation: 'n',
      endLocation: 'e',
      turns: 0.5,
      rotationDirection: 'cw',
      startOrientation: 'in',
      endOrientation: 'out',
    });
    expect(parsed.beats[0]!.right).toEqual({ startLocation: 's', endLocation: 'w' });
  });

  it('parses a bare array of beats', () => {
    const parsed = parseGroundTruth(
      JSON.stringify([
        { left: { startLocation: 'n' }, right: { startLocation: 's' } },
        { left: { startLocation: 'e' } },
      ]),
    );
    expect(parsed.word).toBeUndefined();
    expect(parsed.beats).toHaveLength(2);
    expect(parsed.beats[0]!.left!.startLocation).toBe('n');
    expect(parsed.beats[1]!.left!.startLocation).toBe('e');
  });
});

describe('parseGroundTruth normalization', () => {
  it('lowercases enum-ish spellings', () => {
    const parsed = parseGroundTruth(
      JSON.stringify({
        beats: [
          {
            left: {
              motionType: 'PRO',
              startLocation: 'N',
              endLocation: 'Ne',
              rotationDirection: 'CW',
              startOrientation: 'IN',
              endOrientation: 'Counter',
            },
          },
        ],
      }),
    );
    expect(parsed.beats[0]!.left).toEqual({
      motionType: 'pro',
      startLocation: 'n',
      endLocation: 'ne',
      rotationDirection: 'cw',
      startOrientation: 'in',
      endOrientation: 'counter',
    });
  });

  it('maps full compass names onto the short location forms', () => {
    const parsed = parseGroundTruth(
      JSON.stringify({
        beats: [
          {
            left: { startLocation: 'NORTH', endLocation: 'southwest' },
            right: { startLocation: 'NorthEast', endLocation: 'west' },
          },
        ],
      }),
    );
    expect(parsed.beats[0]!.left).toEqual({ startLocation: 'n', endLocation: 'sw' });
    expect(parsed.beats[0]!.right).toEqual({ startLocation: 'ne', endLocation: 'w' });
  });

  it("accepts turns as a number, a numeric string, or 'fl'", () => {
    const parsed = parseGroundTruth(
      JSON.stringify({
        beats: [
          { left: { turns: 2 }, right: { turns: '1.5' } },
          { left: { turns: 'fl' }, right: { turns: 'FL' } },
        ],
      }),
    );
    expect(parsed.beats[0]!.left!.turns).toBe(2);
    expect(parsed.beats[0]!.right!.turns).toBe(1.5);
    expect(parsed.beats[1]!.left!.turns).toBe('fl');
    expect(parsed.beats[1]!.right!.turns).toBe('fl');
  });
});

describe('parseGroundTruth errors', () => {
  it('names the beat, hand, field, and value for a bad enum', () => {
    const json = JSON.stringify({
      beats: [{ left: { motionType: 'pro' } }, { right: { motionType: 'spin' } }],
    });
    expect(() => parseGroundTruth(json)).toThrowError(/beat 1/);
    expect(() => parseGroundTruth(json)).toThrowError(/red hand/);
    expect(() => parseGroundTruth(json)).toThrowError(/motionType/);
    expect(() => parseGroundTruth(json)).toThrowError(/"spin"/);
  });

  it('rejects a bad location with the field name in the message', () => {
    const json = JSON.stringify({ beats: [{ left: { startLocation: 'up' } }] });
    expect(() => parseGroundTruth(json)).toThrowError(/beat 0, blue hand/);
    expect(() => parseGroundTruth(json)).toThrowError(/startLocation/);
  });

  it('rejects non-numeric, non-fl turns', () => {
    const json = JSON.stringify({ beats: [{ right: { turns: 'lots' } }] });
    expect(() => parseGroundTruth(json)).toThrowError(/beat 0, red hand/);
    expect(() => parseGroundTruth(json)).toThrowError(/turns/);
  });

  it('throws on zero beats in every shape', () => {
    expect(() => parseGroundTruth('{"beats": []}')).toThrowError(/zero beats/);
    expect(() => parseGroundTruth('{"steps": []}')).toThrowError(/zero beats/);
    expect(() => parseGroundTruth('[]')).toThrowError(/zero beats/);
  });

  it('throws on invalid JSON and unrecognized shapes', () => {
    expect(() => parseGroundTruth('not json at all')).toThrowError(/not valid JSON/);
    expect(() => parseGroundTruth('{"foo": 1}')).toThrowError(/Unrecognized ground truth shape/);
  });
});
