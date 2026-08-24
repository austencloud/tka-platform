import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

// Every object in the schema is `.strict()`, so a director inventing an
// axis that sounds plausible — "give them a costume", "set the weather" —
// gets a hard rejection naming the exact key, not a silently-ignored no-op.
// zod's unrecognized-key message quotes the key, and since this throws as a
// ZodError, String(error) is the JSON-stringified issue list — so that
// internal quote comes through escaped, the same reasoning as
// nonexistent.ts and camera.ts.

export const entries: CorpusEntry[] = [
  {
    id: "unknown-axis-performer-propColor",
    utterance: "Make this performer's prop bright red.",
    film: corpusFilm("unknown-axis-performer-propColor", {
      performance: { cast: { count: 1, performers: [{ propColor: "red" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"propColor\\"' },
  },
  {
    id: "unknown-axis-performer-hairColor",
    utterance: "Give this performer blue hair.",
    film: corpusFilm("unknown-axis-performer-hairColor", {
      performance: { cast: { count: 1, performers: [{ hairColor: "blue" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"hairColor\\"' },
  },
  {
    id: "unknown-axis-performer-costume",
    utterance: "Put this performer in a red costume.",
    film: corpusFilm("unknown-axis-performer-costume", {
      performance: { cast: { count: 1, performers: [{ costume: "red-jumpsuit" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"costume\\"' },
  },
  {
    id: "unknown-axis-performer-skinTone",
    utterance: "Set this performer's skin tone.",
    film: corpusFilm("unknown-axis-performer-skinTone", {
      performance: { cast: { count: 1, performers: [{ skinTone: "tan" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"skinTone\\"' },
  },
  {
    id: "unknown-axis-performer-height",
    utterance: "Make this performer taller than the others.",
    film: corpusFilm("unknown-axis-performer-height", {
      performance: { cast: { count: 1, performers: [{ height: 1.9 }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"height\\"' },
  },
  {
    id: "unknown-axis-performer-gender",
    utterance: "Cast this performer as female.",
    film: corpusFilm("unknown-axis-performer-gender", {
      performance: { cast: { count: 1, performers: [{ gender: "female" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"gender\\"' },
  },
  {
    id: "unknown-axis-cast-defaults-lighting",
    utterance: "Set everyone's default lighting to dim.",
    film: corpusFilm("unknown-axis-cast-defaults-lighting", {
      performance: { cast: { count: 2, defaults: { lighting: "dim" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"lighting\\"' },
  },
  {
    id: "unknown-axis-cast-defaults-propMaterial",
    utterance: "Everyone's prop should default to a chrome finish.",
    film: corpusFilm("unknown-axis-cast-defaults-propMaterial", {
      performance: { cast: { count: 2, defaults: { propMaterial: "chrome" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"propMaterial\\"' },
  },
  {
    id: "unknown-axis-cast-choreographer",
    utterance: "The choreographer for this shot is Paul.",
    film: corpusFilm("unknown-axis-cast-choreographer", {
      performance: { cast: { count: 1, choreographer: "Paul" } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"choreographer\\"' },
  },
  {
    id: "unknown-axis-performance-dancers-instead-of-cast",
    utterance: "Here are the dancers for this shot.",
    film: corpusFilm("unknown-axis-performance-dancers-instead-of-cast", {
      performance: { dancers: [{ id: "performer-1" }] },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"dancers\\"' },
  },
  {
    id: "unknown-axis-scene-avatarScale",
    utterance: "Scale up everyone's avatar by 20 percent.",
    film: corpusFilm("unknown-axis-scene-avatarScale", {
      scene: { avatarScale: 1.2 },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"avatarScale\\"' },
  },
  {
    id: "unknown-axis-scene-oceanVariant",
    utterance: "Use the tropical ocean variant for this scene.",
    film: corpusFilm("unknown-axis-scene-oceanVariant", {
      scene: { oceanVariant: "tropical" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"oceanVariant\\"' },
  },
  {
    id: "unknown-axis-scene-timeOfDay",
    utterance: "Set the time of day to dusk.",
    film: corpusFilm("unknown-axis-scene-timeOfDay", {
      scene: { timeOfDay: "dusk" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"timeOfDay\\"' },
  },
  {
    id: "unknown-axis-scene-weather",
    utterance: "Make it rain in this scene.",
    film: corpusFilm("unknown-axis-scene-weather", {
      scene: { weather: "rain" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"weather\\"' },
  },
  {
    id: "unknown-axis-scene-fogDensity",
    utterance: "Turn up the fog density in this scene.",
    film: corpusFilm("unknown-axis-scene-fogDensity", {
      scene: { fogDensity: 0.5 },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"fogDensity\\"' },
  },
  {
    id: "unknown-axis-scene-wallColor",
    utterance: "Paint the walls a deep blue for this scene.",
    film: corpusFilm("unknown-axis-scene-wallColor", {
      scene: { wallColor: "navy" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"wallColor\\"' },
  },
  {
    id: "unknown-axis-camera-plane",
    utterance: "Set the camera's movement plane to the wall.",
    film: corpusFilm("unknown-axis-camera-plane", {
      camera: { plane: "wall" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"plane\\"' },
  },
  {
    id: "unknown-axis-camera-navMode",
    utterance: "Put the camera in orbit nav mode.",
    film: corpusFilm("unknown-axis-camera-navMode", {
      camera: { navMode: "orbit" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"navMode\\"' },
  },
  {
    id: "unknown-axis-camera-lens",
    utterance: "Shoot this with an 85mm lens.",
    film: corpusFilm("unknown-axis-camera-lens", {
      camera: { lens: "85mm" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"lens\\"' },
  },
  {
    id: "unknown-axis-camera-colorGrade",
    utterance: "Apply a teal-and-orange color grade to this shot's camera.",
    film: corpusFilm("unknown-axis-camera-colorGrade", {
      camera: { colorGrade: "teal-orange" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"colorGrade\\"' },
  },
  {
    id: "unknown-axis-camera-stabilization",
    utterance: "Turn on camera stabilization for this move.",
    film: corpusFilm("unknown-axis-camera-stabilization", {
      camera: { stabilization: true },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"stabilization\\"' },
  },
  {
    id: "unknown-axis-film-root-narrator",
    utterance: "Morgan Freeman narrates this film.",
    film: corpusFilm(
      "unknown-axis-film-root-narrator",
      { performance: { cast: { count: 1 } } },
      { narrator: "Morgan Freeman" }
    ),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"narrator\\"' },
  },
  {
    id: "unknown-axis-film-root-musicTrack",
    utterance: "Score the whole film with track seven.",
    film: corpusFilm(
      "unknown-axis-film-root-musicTrack",
      { performance: { cast: { count: 1 } } },
      { musicTrack: "track-07" }
    ),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"musicTrack\\"' },
  },
  {
    id: "unknown-axis-film-root-subtitle",
    utterance: "Give this film the subtitle 'A Study in Motion'.",
    film: corpusFilm(
      "unknown-axis-film-root-subtitle",
      { performance: { cast: { count: 1 } } },
      { subtitle: "A Study in Motion" }
    ),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"subtitle\\"' },
  },
  {
    id: "unknown-axis-shot-mood",
    utterance: "This shot's mood should be somber.",
    film: corpusFilm("unknown-axis-shot-mood", {
      mood: "somber",
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"mood\\"' },
  },
  {
    id: "unknown-axis-shot-soundEffect",
    utterance: "Play a whoosh sound effect during this shot.",
    film: corpusFilm("unknown-axis-shot-soundEffect", {
      soundEffect: "whoosh",
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"soundEffect\\"' },
  },
  {
    id: "unknown-axis-shot-notes",
    utterance: "Leave a director's note on this shot: 'reshoot if the timing feels off'.",
    film: corpusFilm("unknown-axis-shot-notes", {
      notes: "reshoot if the timing feels off",
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"notes\\"' },
  },
  {
    id: "unknown-axis-performer-nickname",
    utterance: "Give this performer the nickname 'Flash'.",
    film: corpusFilm("unknown-axis-performer-nickname", {
      performance: { cast: { count: 1, performers: [{ nickname: "Flash" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unrecognized key: \\"nickname\\"' },
  },
];
