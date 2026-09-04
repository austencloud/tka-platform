import {
  MODE_FAMILY_ID,
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";

export type TimingValue = "Together" | "Split" | "Quarter";
export type DirectionValue = "Same" | "Opposite";

export interface TimingDirectionSource {
  readonly label: string;
  readonly url: string;
  readonly detail: string;
}

export interface TimingDirectionArticle {
  readonly code: VtgMode;
  readonly slug: string;
  readonly familyId: string;
  readonly name: string;
  readonly compactName: string;
  readonly timing: TimingValue;
  readonly direction: DirectionValue;
  readonly phase: "0°" | "90° / 270°" | "180°";
  readonly representativeLetter: string;
  readonly definition: string;
  readonly watchFor: string;
  readonly example: string;
  readonly geometry: string;
  readonly commonMistake: string;
  readonly tkaConnection: string;
  readonly history: string;
  readonly aliases: readonly string[];
  readonly metaDescription: string;
  readonly sources: readonly TimingDirectionSource[];
}

const HOW_TO_DEFINE_A_WEAVE =
  "https://www.homeofpoi.com/en/community/forums/topics/120838/How-do-you-define-a-weave";
const QUARTER_TIME_BUTTERFLIES =
  "https://www.homeofpoi.com/en/community/forums/topics/122222/Concept-moves-and-why-make-lists";
const FOUR_MODE_MAPPING =
  "https://www.homeofpoi.com/fr/community/forums/topics/611260/1/Re-Can-you-do-this-move";
const TIMING_NOT_PLACEMENT =
  "https://www.homeofpoi.com/fr/community/forums/topics/661099/degrees";
const NOEL_TRANSITIONS =
  "https://www.homeofpoi.com/fr/community/forums/topics/887635/X-Post-Prop-Transitioning-Article";
const PHASE_AND_SYMMETRY =
  "https://www.homeofpoi.com/us/community/forums/topics/899386/In-Depth-Move-Families";
const QUARTER_CHASE =
  "https://drexfactor.com/weirdscience/2011/11/16/drexs_tech_poi_blog_209_third_order_quarter_time_chase";
const TKA_PUBLIC_RECORD =
  "https://github.com/austencloud/tka-platform/commit/50bdc56725b54fbb363224b8f9f001228b988e02";

const SOURCE_FOUR_MODE_MAPPING: TimingDirectionSource = {
  label: "Can you do this move?",
  url: FOUR_MODE_MAPPING,
  detail:
    "2005 discussion separating timing from direction and mapping all four original combinations.",
};

const SOURCE_NOEL_TRANSITIONS: TimingDirectionSource = {
  label: "Prop Transitioning Article",
  url: NOEL_TRANSITIONS,
  detail: "Noel Yee's 2009 four-mode transition synthesis.",
};

const ARTICLE_BY_CODE = {
  SS: {
    slug: "split-time-same-direction",
    name: "Split Time, Same Direction",
    compactName: "Split-Same",
    timing: "Split",
    direction: "Same",
    phase: "180°",
    representativeLetter: "A",
    definition:
      "Both props rotate in the same direction while staying half a cycle apart. When one prop reaches the top of its circle, the other reaches the bottom.",
    watchFor:
      "Watch for a steady chase. The props follow the same rotational route, but the 180-degree phase gap keeps them on opposite sides of their circles.",
    example:
      "The regular three-beat weave is the standard historical example. Windmills and many fountains also live in Split-Same when their prop relationship stays unchanged.",
    geometry:
      "Same direction preserves the phase gap. Once the props are split by 180 degrees, equal-speed rotation keeps that separation in place.",
    commonMistake:
      "Split describes timing, not rotational direction. Split-Same can run clockwise or counterclockwise as long as both props turn the same way.",
    tkaConnection:
      "TKA letter A is a representative Split-Same dual-shift. The Water element marks this family throughout the current TKA system.",
    history:
      "Same-direction split timing appears in the 2002 weave discussion. A 2005 terminology thread then names the full combination and maps the regular weave to it, before Noel's 2009 transition synthesis and VTG's later codification.",
    aliases: ["Split-Same", "SS", "Split time", "Follow time"],
    metaDescription:
      "Split Time, Same Direction explained: the 180-degree chase behind weaves and windmills, with animation, history, TKA mapping, and related modes.",
    sources: [
      {
        label: "How do you define a weave?",
        url: HOW_TO_DEFINE_A_WEAVE,
        detail: "2002 discussion of split timing and same-direction weaves.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      SOURCE_NOEL_TRANSITIONS,
    ],
  },
  TS: {
    slug: "together-time-same-direction",
    name: "Together Time, Same Direction",
    compactName: "Together-Same",
    timing: "Together",
    direction: "Same",
    phase: "0°",
    representativeLetter: "G",
    definition:
      "Both props rotate in the same direction and reach corresponding points in their circles at the same moment. Their phase difference is zero.",
    watchFor:
      "The two prop heads rise, cross, and fall as a matched pair. At equal speed, neither prop gains on the other.",
    example:
      "A parallel weave is the common historical example. The 2005 four-mode mapping describes a four-beat parallel weave as Together-Same.",
    geometry:
      "The prop bearings remain parallel because the direction and speed match. Starting together keeps them together throughout the cycle.",
    commonMistake:
      "Same direction does not mean a fixed clock direction. Both props may rotate clockwise or both may rotate counterclockwise.",
    tkaConnection:
      "TKA letter G is a representative Together-Same dual-shift. The Earth element marks this family in the current TKA system.",
    history:
      "The 2002 weave discussion recognizes same-direction motion without split timing. The 2005 terminology thread names the exact combination and maps a parallel weave to it. Noel's 2009 article carries the mode into his transition framework.",
    aliases: ["Together-Same", "Tog-Same", "TS", "Parallel time"],
    metaDescription:
      "Together Time, Same Direction explained: zero-degree parallel prop timing, animation, examples, history, TKA mapping, and links to all six modes.",
    sources: [
      {
        label: "How do you define a weave?",
        url: HOW_TO_DEFINE_A_WEAVE,
        detail:
          "2002 discussion of the timing and direction variables behind weaves.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      SOURCE_NOEL_TRANSITIONS,
    ],
  },
  QS: {
    slug: "quarter-time-same-direction",
    name: "Quarter Time, Same Direction",
    compactName: "Quarter-Same",
    timing: "Quarter",
    direction: "Same",
    phase: "90° / 270°",
    representativeLetter: "S",
    definition:
      "Both props rotate in the same direction with a quarter-cycle phase gap. One prop leads the other by 90 degrees, and swapping the leader creates the other chirality.",
    watchFor:
      "The prop bearings stay perpendicular as the pair rotates. The same prop remains one quarter-cycle ahead until the timing changes.",
    example:
      "Quarter-time weaves were already part of a 2005 naming discussion. Later poi writing applies the relationship to stalls, floats, flowers, and third-order chases.",
    geometry:
      "Equal-speed rotation in the same direction preserves the 90-degree phase gap. The relationship has two versions because either prop can lead.",
    commonMistake:
      "Quarter timing is not gamma placement. Quarter describes the props' phase; gamma describes hands occupying adjacent grid points.",
    tkaConnection:
      "TKA letter S is a representative Quarter-Same dual-shift. The Sun element marks this family, whose TKA letters are S through V.",
    history:
      "Quarter time appears in public poi discussions by 2002. The 2005 terminology debate uses quarter-time weaves to show why timing and direction must remain separate. A 2009 phase discussion describes the same-direction quarter geometry directly.",
    aliases: ["Quarter-Same", "QS", "Quarter time", "90-degree phase"],
    metaDescription:
      "Quarter Time, Same Direction explained: the 90-degree same-direction relationship, leader and follower, animation, history, and TKA's Sun family.",
    sources: [
      {
        label: "Concept moves and why make lists?",
        url: QUARTER_TIME_BUTTERFLIES,
        detail:
          "Earliest explicit quarter-time wording located in this audit, dated 2002.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      {
        label: "In Depth Move Families",
        url: PHASE_AND_SYMMETRY,
        detail:
          "2009 phase-and-symmetry description of same-direction quarter timing.",
      },
      {
        label: "Third-order quarter time chase",
        url: QUARTER_CHASE,
        detail: "DrexFactor's 2011 same-direction quarter-time exploration.",
      },
      {
        label: "TKA public repository record",
        url: TKA_PUBLIC_RECORD,
        detail:
          "Immutable 2025 commit containing quarter/same records in separate timing and direction fields.",
      },
    ],
  },
  SO: {
    slug: "split-time-opposite-direction",
    name: "Split Time, Opposite Direction",
    compactName: "Split-Opposite",
    timing: "Split",
    direction: "Opposite",
    phase: "180°",
    representativeLetter: "J",
    definition:
      "The props rotate in opposite directions while staying 180 degrees out of phase. Their downbeats alternate instead of arriving together.",
    watchFor:
      "The pair mirrors across a horizontal reference when viewed in the standard wall-plane model. One prop reaches the top while the other reaches the bottom.",
    example:
      "A split-time butterfly is the standard historical example. The 2005 four-mode mapping uses a three-beat split-time butterfly to name the combination.",
    geometry:
      "Opposite rotation creates mirror symmetry. The 180-degree timing offset places the mirror line across the horizontal axis in the conventional upright view.",
    commonMistake:
      "Older vocabulary sometimes used split-time as a combined name for this motion. Keeping timing and direction separate prevents that label from swallowing Split-Same.",
    tkaConnection:
      "TKA letter J is a representative Split-Opposite dual-shift. The Fire element marks this family in the current TKA system.",
    history:
      "The possibility appears in the 2002 four-relationship discussion. The 2005 thread supplies the exact Split-Time, Opposite-Direction mapping and also preserves the older combined vocabulary that caused confusion.",
    aliases: ["Split-Opposite", "Split-Opp", "SO", "Split-time butterfly"],
    metaDescription:
      "Split Time, Opposite Direction explained: the 180-degree butterfly relationship, animation, symmetry, history, TKA mapping, and related modes.",
    sources: [
      {
        label: "How do you define a weave?",
        url: HOW_TO_DEFINE_A_WEAVE,
        detail: "2002 discussion recognizing opposite-direction split timing.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      SOURCE_NOEL_TRANSITIONS,
    ],
  },
  TO: {
    slug: "together-time-opposite-direction",
    name: "Together Time, Opposite Direction",
    compactName: "Together-Opposite",
    timing: "Together",
    direction: "Opposite",
    phase: "0°",
    representativeLetter: "D",
    definition:
      "The props rotate in opposite directions and arrive at corresponding points together. Their downbeats land at the same moment.",
    watchFor:
      "In the standard upright view, the moving pair reflects across a vertical line. Both props reach the top or bottom of their circles together.",
    example:
      "The regular butterfly is the standard example. Its two sides move as mirror images while sharing the same beat.",
    geometry:
      "Opposite rotation creates a mirror relationship. Zero phase places the mirror line vertically in the conventional wall-plane view.",
    commonMistake:
      "Together describes the phase relationship, not the direction. The props can share a beat while rotating away from each other.",
    tkaConnection:
      "TKA letter D is a representative Together-Opposite dual-shift. The Air element marks this family in the current TKA system.",
    history:
      "Butterfly timing appears in the 2002 discussion. The 2005 four-mode mapping names the regular butterfly as Together Time, Opposite Direction, and Noel's 2009 transition article carries the same variables into VTG's teaching lineage.",
    aliases: ["Together-Opposite", "Tog-Opp", "TO", "Butterfly"],
    metaDescription:
      "Together Time, Opposite Direction explained: butterfly timing, zero-degree mirror symmetry, animation, history, TKA mapping, and related modes.",
    sources: [
      {
        label: "How do you define a weave?",
        url: HOW_TO_DEFINE_A_WEAVE,
        detail:
          "2002 discussion using butterflies to distinguish timing and direction.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      SOURCE_NOEL_TRANSITIONS,
    ],
  },
  QO: {
    slug: "quarter-time-opposite-direction",
    name: "Quarter Time, Opposite Direction",
    compactName: "Quarter-Opposite",
    timing: "Quarter",
    direction: "Opposite",
    phase: "90° / 270°",
    representativeLetter: "M",
    definition:
      "The props rotate in opposite directions with a quarter-cycle phase gap. One prop leads by 90 degrees, producing left-leading and right-leading versions.",
    watchFor:
      "The mirror line sits on a diagonal in the standard wall-plane model. Changing which prop leads switches that diagonal to its counterpart.",
    example:
      "Quarter-time butterflies are the earliest explicit quarter-time example located in this audit. The relationship also appears in later phase writing about pendulums, stalls, and circular patterns.",
    geometry:
      "Opposite rotation keeps mirror symmetry while the quarter-cycle offset turns its axis from vertical or horizontal to a diagonal. Either prop can lead.",
    commonMistake:
      "Quarter timing does not identify where the hands are placed. A Quarter-Opposite prop relationship can be described independently of alpha, beta, or gamma hand placement.",
    tkaConnection:
      "TKA letter M is a representative Quarter-Opposite dual-shift. The Moon element marks this family, whose TKA letters are M through R.",
    history:
      "A public 2002 discussion names quarter-time butterflies. In 2005, quarter-time butterflies become an explicit reason to separate timing from direction. The 2009 phase-and-symmetry discussion describes the opposite-direction quarter case as a diagonal mirror relationship.",
    aliases: [
      "Quarter-Opposite",
      "Quarter-Opp",
      "QO",
      "Quarter-time butterfly",
    ],
    metaDescription:
      "Quarter Time, Opposite Direction explained: the 90-degree diagonal mirror relationship, leader and follower, animation, history, and TKA's Moon family.",
    sources: [
      {
        label: "Concept moves and why make lists?",
        url: QUARTER_TIME_BUTTERFLIES,
        detail: "2002 public use of quarter-time butterflies.",
      },
      SOURCE_FOUR_MODE_MAPPING,
      {
        label: "degrees",
        url: TIMING_NOT_PLACEMENT,
        detail:
          "2005 distinction between quarter timing and the spatial angle of a move.",
      },
      {
        label: "In Depth Move Families",
        url: PHASE_AND_SYMMETRY,
        detail:
          "2009 description of opposite-direction quarter timing and its diagonal mirror line.",
      },
      {
        label: "TKA public repository record",
        url: TKA_PUBLIC_RECORD,
        detail:
          "Immutable 2025 commit containing quarter/opposite records in separate timing and direction fields.",
      },
    ],
  },
} as const satisfies Record<
  VtgMode,
  Omit<TimingDirectionArticle, "code" | "familyId">
>;

export const TIMING_DIRECTION_ARTICLES: readonly TimingDirectionArticle[] =
  MODE_ORDER.map((code) => ({
    code,
    familyId: MODE_FAMILY_ID[code],
    ...ARTICLE_BY_CODE[code],
  }));

export const TIMING_DIRECTION_ARTICLE_SLUGS = TIMING_DIRECTION_ARTICLES.map(
  ({ slug }) => slug
);

export function getTimingDirectionArticle(
  slug: string
): TimingDirectionArticle | undefined {
  return TIMING_DIRECTION_ARTICLES.find((article) => article.slug === slug);
}

export function getTimingDirectionArticleByPair(
  timing: TimingValue,
  direction: DirectionValue
): TimingDirectionArticle {
  const article = TIMING_DIRECTION_ARTICLES.find(
    (candidate) =>
      candidate.timing === timing && candidate.direction === direction
  );
  if (!article) {
    throw new Error(
      `Missing timing/direction article for ${timing}/${direction}`
    );
  }
  return article;
}
