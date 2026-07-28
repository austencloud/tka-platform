/**
 * The /notation catalog — a chronological record of systems for writing flow
 * arts down.
 *
 * Sourcing rules (docs/superpowers/specs/2026-07-26-notation-catalog-design.md):
 * every `records` line traces to a primary that was actually read, no acronym is
 * expanded without one, and no date is guessed. If a fact cannot be sourced it
 * does not appear — which is why some rows are shorter than others, and why
 * Transition Theory has no row.
 *
 * The rule against claiming a relationship between entries has ONE exception,
 * added 2026-07-28: Lorq Nichols and the Vulcan Tech Gospel. That one is not an
 * inference from structural similarity — it is documented from both sides, and
 * the evidence is cited on the `lorq` entry. Everything else on this page stays
 * silent about influence, because silence is the honest default when the only
 * argument is that two systems look alike.
 *
 * The Home of Poi threads are behind a Cloudflare challenge that blocks every
 * automated client, and no homeofpoi.com forum topic has ever been captured by
 * the Wayback Machine. They were read in a browser and archived verbatim to
 * E:\flow-arts-wiki\content\sources\homeofpoi\ — that archive, not memory, is
 * what these lines rest on.
 */

export interface CatalogSource {
  label: string;
  href: string;
}

export interface CatalogVideo {
  id: string;
  title: string;
  creator: string;
  year: string;
  note: string;
}

export interface CatalogSubWork {
  name: string;
  note: string;
}

export interface CatalogEntry {
  id: string;
  /** Display string. "2009", "c. 2010", "2012–" — rendered as written. */
  year: string;
  /** Ordering only. Never rendered. */
  sortYear: number;
  system: string;
  people: string;
  /** The one sourced line: what the system records. Never how to use it. */
  records: string;
  subWorks?: CatalogSubWork[];
  sources: CatalogSource[];
  videos?: CatalogVideo[];
  /**
   * A page on this site where the system can actually be run, as opposed to
   * read about. Distinct from `sources`, which is headed "Read it there" and
   * points outward at primaries — this points inward at something interactive,
   * and only exists for entries that have one built.
   */
  explore?: CatalogSource;
}

const HOP_CAPS =
  "https://www.homeofpoi.com/en/community/forums/topics/891193/What-are-CAP-s";
const HOP_QFT =
  "https://www.homeofpoi.com/us/community/forums/topics/932537/A-Beginner-s-Guide-to-Prop-QFT-Notation";
const HOP_TOE =
  "https://www.homeofpoi.com/us/community/forums/topics/886966/Poi-Theory-of-Everything-An-ongoing-collaboration";
const HOP_FLOWERS =
  "https://www.homeofpoi.com/us/community/forums/topics/907828/A-mathematical-approach-to-advanced-flower-patterns";

export const NOTATION_CATALOG: CatalogEntry[] = [
  {
    id: "caps",
    year: "2009",
    sortYear: 2009,
    system: "Continuous Assembly Patterns",
    people: "Damien, posting as French_Saltimbanque, on the Home of Poi forums",
    // Alien Jon in-thread: "taking basic 'poi geometry' building blocks or
    // fractional piece of other moves with simpler symmetry and assembling them
    // together into more complexly layered moves."
    records:
      "Fractions of separate moves assembled into one pattern that repeats without a seam. Alien Jon, who took up the term in the same thread, is careful that it names a way of thinking about movement rather than a move.",
    sources: [{ label: "The thread where the term was coined", href: HOP_CAPS }],
  },
  {
    id: "trochoid",
    year: "2009",
    sortYear: 2009.1,
    system: "The trochoid model",
    people:
      "Zaltymbunk, of Angers, France. Danny_, in Brighton, was modelling the same problem independently against the ground rather than the arm.",
    // Verbatim from the archived thread: "The patterns will be defined in the
    // following way : Theta1 Theta2 ; Rho1 Rho2", plus the later division term.
    records:
      "A pattern written as two numbers of turns and two radii: Theta1 Theta2 ; Rho1 Rho2. A division term takes a fraction of the cycle instead of all of it. It carries a wrap table and a cycloid condition, plus rules for which patterns are physically possible.",
    sources: [
      { label: "The model, posted in full", href: HOP_CAPS },
      { label: "Pattern sheets generated from it", href: HOP_FLOWERS },
    ],
  },
  {
    id: "unit-circle",
    year: "2009",
    sortYear: 2009.2,
    system: "Unit Circle Theory",
    people: "Alien Jon",
    // His own words, archived: diameter of 1, one poi length as the unit, in
    // service of "symmetry and proportion as applied to poi."
    records:
      "One poi length as the unit, with the circle taken as diameter 1 rather than the mathematician's radius 1, so a pattern's proportions hold at any prop length. Alien Jon marks it as a poi-specific term, not the trigonometric one.",
    sources: [
      { label: "Alien Jon defining it in his own words", href: HOP_TOE },
    ],
  },
  {
    id: "vtg",
    year: "2010",
    sortYear: 2010,
    system: "Vulcan Tech Gospel",
    people:
      "Compiled by Noel Yee, with David “Tankboy” Cantor, Lorq Nichols, Brian Thompson, Maiki Nope, and a final chapter Ben Drexler had a hand in. Logo by Forest Stearns.",
    // Yee's own site: "The first goal of VTG is to help the user to understand
    // the variety of flower patterns available in a given arm and prop timing
    // and direction. The second is to teach the user how to transition between
    // patterns within a given timing and direction." Volume 1's ten shapes are
    // from Yee's own walkthrough video.
    records:
      "The flower patterns available within a given timing and direction, and how to move between them. Volume 1 covers the one-to-one case as ten minimal beat shapes for two hands: isolation, extension, vertical antispin, horizontal antispin, and the six hybrids they stack into.",
    subWorks: [
      {
        name: "VTG 1",
        note: "2010, released 2011: five chapters, five different authors",
      },
      {
        name: "VTG #2",
        note: "October 2011, Cantor and Yee: past the one-to-one case, to three-to-three",
      },
      {
        name: "Book of P.H.A.T. Volume 1",
        note: "illustrated and written by Lorq Nichols, with Thompson, Cantor and Yee. The Shape Matrix is page 32",
      },
      {
        name: "VTG 3",
        note: "announced in 2019 as the final installment; never published",
      },
    ],
    sources: [
      {
        label: "The Vulcan Tech Gospel, on Noel Yee's site",
        href: "https://noelyee.com/instruction/vulcan-tech-gospel/",
      },
    ],
  },
  {
    id: "nine-square",
    year: "c. 2010",
    sortYear: 2010.5,
    system: "9-Square Theory",
    people: "Charlie Cushing",
    records:
      "A nine-point grid, plus the poi length and planes it assumes. The series runs eleven parts, from direction and timing out to stalls and footwork.",
    sources: [
      {
        label: "Charlie's 9-square theory, all eleven parts",
        href: "https://www.youtube.com/playlist?list=PLDE05D5E593C54AED",
      },
    ],
    videos: [
      {
        id: "J_jpE31_9DE",
        title: "Charlie's 9-Square Theory Introduction for Poi",
        creator: "Charlie Cushing",
        year: "",
        note: "Where the series starts.",
      },
      {
        id: "VfqPBoVCt-0",
        title: "#1: Poi Length, Planes, 9-Square Introduction",
        creator: "Charlie Cushing",
        year: "",
        note: "The grid itself, and the proportion everything else assumes.",
      },
      {
        id: "nGwLdHSDokI",
        title: "#2: Direction, Timing, and Poly-Timing in 9-Square",
        creator: "Charlie Cushing",
        year: "",
        note: "",
      },
      {
        id: "Lh5wtTddhEE",
        title: "#3: Polyrhythmic Hybrids and Timing Changes",
        creator: "Charlie Cushing",
        year: "",
        note: "",
      },
    ],
  },
  {
    id: "qft",
    year: "2011",
    sortYear: 2011,
    system: "QFT Notation",
    people:
      "Charlie Cushing, who dreamed up the concept. Ben Drexler wrote the primer; Alien Jon and Noel Yee gave feedback on the class the two of them taught at Kinetic Fire Festival.",
    // The primer is the only public document that expands the acronym, so the
    // expansion ships: "Charlie's Quantized Field Theory for poi and one of its
    // applications: notation for props."
    records:
      "A circle cut into eight positions, and movement written as where the prop leaves, where it arrives, and which way it is travelling at each end. The full formula is a,b(h(±x±y±z)h'){Class}a',b'.",
    sources: [
      { label: "The primer, on the Home of Poi forums", href: HOP_QFT },
      // The same primer on Drex's own blog. Listed because it is the copy whose
      // diagrams still load — the forum's images are all dead placeholders now.
      {
        label: "The same primer on Drex's blog, diagrams intact",
        href: "https://drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation",
      },
    ],
    explore: { label: "Run the notation", href: "/notation/qft" },
  },
  {
    id: "lorq",
    year: "2012–",
    sortYear: 2012,
    system: "Lorq Nichols' catalogs",
    people: "Lorq Nichols, publishing as Spin Science",
    // The one relationship claim in this catalog, and the only one with primary
    // sources on BOTH sides — the standard the header sets. Yee's 2015 app page
    // lists "VTG Authors: Noel Yee, David Cantor, Brian Thompson, Lorq Nichols";
    // Nichols' own 2012 Tech Tiles post thanks "Noel Yee (this chart
    // intrinsically encompasses transition theory), and all the Vulcan Tech
    // Gospel crew"; and the Book of P.H.A.T. cover and contents page put the
    // Shape Matrix at page 32 of a volume titled Vulcan Tech Gospel. Nichols
    // also cites VTG#2 as source material throughout his LORQ:TECH series.
    records:
      "Patterns enumerated rather than described. Driving styles crossed against each other, arm paths crossed against club shapes, until the grid is full. Nichols is one of the four Vulcan Tech Gospel authors, and this work is not separate from it: the Shape Matrix is page 32 of Vulcan Tech Gospel Book of P.H.A.T. Volume 1.",
    subWorks: [
      {
        name: "144 Shape Matrix",
        note: "twelve driving styles against twelve; his own gloss is “a multiplication table for tricks”",
      },
      { name: "324 Patterns", note: "counted from arm paths and club shapes" },
      {
        name: "27 Arm Paths",
        note: "three axes, three planes, nine arm positions, and the transitions between them",
      },
      {
        name: "Tech Tiles / Book of P.H.A.T.",
        note: "published as Vulcan Tech Gospel Book of P.H.A.T. Volume 1, with Brian Thompson, David Cantor, and Noel Yee",
      },
      {
        name: "Position Matrix",
        note: "2013, with Brian Thompson and David Cantor: the 1:1 club flowers and every transition between them",
      },
    ],
    // Nichols' live site, spinscience.xyz, is deliberately NOT in this list.
    // Its HTTPS certificate is expired, so an https:// link fails outright and
    // an http:// one breaks the catalog's https-only contract (enforced by
    // tests/unit/notation-roots-remediation-contract.test.ts). Both of his
    // domains that still serve over https are below, and the live site is
    // linked in full from /notation/shape-matrix, where the http exception is
    // made once and explained.
    sources: [
      {
        label: "Book of P.H.A.T.",
        href: "https://sirlorq.wordpress.com/tech-tiles/",
      },
      {
        label: "324 Patterns",
        href: "https://sirlorq.wordpress.com/324-patterns/",
      },
      { label: "LORQ:TECH", href: "https://www.youtube.com/user/SirLorq" },
    ],
    explore: { label: "Run the Shape Matrix", href: "/notation/shape-matrix" },
  },
  {
    id: "poinotation",
    year: "2016",
    sortYear: 2016,
    system: "PoiNotation",
    people: "Tiffany Fong",
    records: "Poi movement written as text a program can read back.",
    sources: [
      {
        label: "The repository",
        href: "https://github.com/tiffanyfong/PoiNotation",
      },
    ],
  },
  {
    id: "tka",
    year: "2022",
    sortYear: 2022,
    system: "The Kinetic Alphabet",
    people: "Austen Cloud",
    records:
      "Each pair of positions given a letter, so a sequence can be read back and searched as a word.",
    sources: [{ label: "The guide", href: "/guide" }],
  },
];
