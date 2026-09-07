// Major pentatonic intervals from C4. Keeping the note assignment free of
// browser and audio dependencies lets the worker simulate the exact swarm while
// the application thread remains the sole owner of Web Audio playback.
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9] as const;
const ROOT_MIDI = 60;

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]! + (Math.floor(midi / 12) - 1);
}

/** Ascending major-pentatonic MIDI notes, wrapping through octaves. */
export function buildPentatonicNotes(count: number): number[] {
  const notes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const octave = Math.floor(index / MAJOR_PENTATONIC.length);
    notes.push(
      ROOT_MIDI + MAJOR_PENTATONIC[index % MAJOR_PENTATONIC.length]! + octave * 12,
    );
  }
  return notes;
}
