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
    "2005: timing and direction defined separately, with examples of all four combinations.",
};

const SOURCE_NOEL_TRANSITIONS: TimingDirectionSource = {
  label: "Prop Transitioning Article",
  url: NOEL_TRANSITIONS,
  detail:
    "2009: Noel Yee on transitions between the four timing and direction modes.",
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
      "Both hands circle in the same direction, half a cycle apart. When one reaches the top, the other reaches the bottom.",
    watchFor:
      "The gap stays the same as they move. Neither side catches up with the other.",
    example:
      "A regular three-beat poi weave uses Split-Same. So do windmills that keep the same timing.",
    commonMistake:
      "Split means half a cycle apart. It says nothing about direction: both can turn clockwise, or both counterclockwise.",
    tkaConnection:
      "A is a Split-Same dual-shift. Water identifies this family in TKA.",
    history:
      "Poi spinners discussed same-direction split timing in a 2002 weave thread. A 2005 discussion names Split-Same explicitly; Noel Yee includes it in his 2009 transition article.",
    aliases: ["Split-Same", "SS", "Split time", "Follow time"],
    metaDescription:
      "Split Time, Same Direction: half a cycle apart, turning the same way. See the hand-path animation, poi examples, TKA connection, and historical sources.",
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
      "Both hands circle in the same direction and reach matching points at the same time.",
    watchFor:
      "Both reach the top together, then the side, then the bottom. Their relative timing stays unchanged.",
    example:
      "In poi, a parallel weave uses Together-Same. The 2005 discussion below gives a four-beat parallel weave as an example.",
    commonMistake:
      "Same direction can mean both clockwise or both counterclockwise. Together means they share the same beat.",
    tkaConnection:
      "G is a Together-Same dual-shift. Earth identifies this family in TKA.",
    history:
      "A 2005 poi discussion names Together Time, Same Direction and connects it to parallel weaves. Noel Yee uses the same relationship in his 2009 transition article.",
    aliases: ["Together-Same", "Tog-Same", "TS", "Parallel time"],
    metaDescription:
      "Together Time, Same Direction: matching points on the same beat. See the hand-path animation, parallel-weave example, TKA connection, and sources.",
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
      "Both hands circle in the same direction, a quarter-cycle apart. Either hand can lead.",
    watchFor:
      "When one reaches the top, the other is at the side. At equal speed, that quarter-cycle gap stays fixed.",
    example:
      "Quarter-time poi weaves appear in the 2005 discussion below. DrexFactor also uses this timing in a third-order chase in 2011.",
    commonMistake:
      "Quarter time describes when things arrive. Gamma describes hands on adjacent grid points. Timing and placement are separate.",
    tkaConnection:
      "S is a Quarter-Same dual-shift. Sun identifies the S–V family in TKA.",
    history:
      "Quarter-time wording appears in a 2002 poi discussion. In 2005, spinners discuss quarter-time weaves while distinguishing timing from direction. A 2009 thread describes the same-direction case in terms of phase.",
    aliases: ["Quarter-Same", "QS", "Quarter time", "90-degree phase"],
    metaDescription:
      "Quarter Time, Same Direction: a quarter-cycle gap with either side leading. Hand-path animation, poi examples, TKA's Sun family, and historical sources.",
    sources: [
      {
        label: "Concept moves and why make lists?",
        url: QUARTER_TIME_BUTTERFLIES,
        detail: "2002: quarter-time butterflies discussed by name.",
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
          "2025: TKA data with separate quarter-time and same-direction fields.",
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
      "The hands circle in opposite directions. One reaches the bottom halfway between the other's downbeats.",
    watchFor:
      "In this upright view, one reaches the top as the other reaches the bottom. Their paths mirror each other across a horizontal line.",
    example:
      "A split-time poi butterfly uses this relationship. Its downbeats alternate.",
    commonMistake:
      "Split time also exists in same-direction motion. Add the direction to distinguish a split-time butterfly from a regular weave.",
    tkaConnection:
      "J is a Split-Opposite dual-shift. Fire identifies this family in TKA.",
    history:
      "The 2002 weave discussion includes opposite-direction split timing. A 2005 thread explicitly maps Split Time, Opposite Direction to a split-time butterfly.",
    aliases: ["Split-Opposite", "Split-Opp", "SO", "Split-time butterfly"],
    metaDescription:
      "Split Time, Opposite Direction: opposite rotation with alternating downbeats. See the hand-path animation, butterfly example, TKA connection, and sources.",
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
      "The hands circle in opposite directions and reach the top and bottom together.",
    watchFor:
      "In this upright view, the two paths mirror each other across a vertical line.",
    example:
      "A regular poi butterfly uses Together-Opposite. Both poi heads share the same downbeat.",
    commonMistake:
      "Together describes timing, not direction. Two motions can share a beat while turning opposite ways.",
    tkaConnection:
      "D is a Together-Opposite dual-shift. Air identifies this family in TKA.",
    history:
      "The 2005 discussion below names a regular butterfly as Together Time, Opposite Direction. Noel Yee includes the same relationship in his 2009 transition article.",
    aliases: ["Together-Opposite", "Tog-Opp", "TO", "Butterfly"],
    metaDescription:
      "Together Time, Opposite Direction: opposite rotation on the same beat. See the butterfly relationship, hand-path animation, TKA connection, and sources.",
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
      "The hands circle in opposite directions, a quarter-cycle apart. Either hand can lead.",
    watchFor:
      "In this upright view, the paths mirror each other across a diagonal. Swapping the lead changes which diagonal.",
    example:
      "Quarter-time poi butterflies use this relationship. They are named in the 2002 discussion below.",
    commonMistake:
      "Quarter time describes when things arrive, not where the hands are placed. Alpha, beta, and gamma describe placement separately.",
    tkaConnection:
      "M is a Quarter-Opposite dual-shift. Moon identifies the M–R family in TKA.",
    history:
      "A 2002 poi discussion names quarter-time butterflies. A 2005 thread uses them to explain why timing and direction need separate names. In 2009, spinners describe their diagonal mirror symmetry.",
    aliases: [
      "Quarter-Opposite",
      "Quarter-Opp",
      "QO",
      "Quarter-time butterfly",
    ],
    metaDescription:
      "Quarter Time, Opposite Direction: opposite rotation a quarter-cycle apart. Hand-path animation, quarter-time butterflies, TKA's Moon family, and sources.",
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
          "2025: TKA data with separate quarter-time and opposite-direction fields.",
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
