/**
 * The one canonical FAQ for the whole public site.
 *
 * Before this, the same questions lived in three drifting copies: the about
 * page's visible markup, the about page's FAQPage JSON-LD, and an orphaned
 * 9-item FAQPage schema on the landing route that had NO visible counterpart
 * (a Google policy violation: schema must match on-page content). A fourth,
 * divergent 4-item list sat dead in routes/landing/components/FAQSection.svelte.
 *
 * Now both /about and the landing page render `FaqInterview`, which draws its
 * visible list AND its JSON-LD from this single array. Edit copy here once.
 *
 * Every item follows claim → proof → door: prose answers a real visitor's
 * hesitation in their own voice, a `demo` renders live proof where the answer
 * makes a claim (see FaqPictographDemo / FaqReadTest), and a `cta` routes the
 * reader to the next step. The JSON-LD serializes question + answer prose
 * only, so the schema always matches the visible text; demos and CTAs are
 * extra on-page content, which the FAQ rich-result policy allows.
 * Design: docs/superpowers/specs/2026-07-16-interactive-faq-design.md
 */

export type FaqCta = { label: string; href: string };
export type FaqDemo = "pictograph" | "read-test";

export type FaqItem = {
  question: string;
  answer: string;
  demo?: FaqDemo;
  cta?: FaqCta;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is The Kinetic Alphabet?",
    answer:
      "Notation for flow arts: a way to write prop movement down instead of relying on video alone. Each beat becomes one pictograph showing hand positions on a grid, the motion each hand makes, and the prop's orientation. String them together and you have choreography you can read, edit, and hand to another spinner.",
    demo: "pictograph",
    cta: { label: "Watch a sequence build", href: "/#how-it-works" },
  },
  {
    question: "Do I have to memorize letters and symbols first?",
    answer:
      "No. Pictographs read visually: the grid shows where your hands can be, the arrows show where they go. The letters are names for patterns, useful once you want to compare and remix sequences. Nothing needs to be memorized before you can follow along.",
    demo: "read-test",
    cta: { label: "Start Level 1", href: "/learn/guide" },
  },
  {
    question: "I learn moves from videos. Why would I need notation?",
    answer:
      "Video shows one performance from one angle. Notation shows the structure underneath it. Once a sequence is written down you can change one beat and see exactly what follows, trade it with someone who has never seen the original, or come back in a year and read it cold. A recording and sheet music do different jobs. Musicians keep both.",
    cta: { label: "Open the composer", href: "/composer" },
  },
  {
    question: "I've never spun a prop. Where do I start?",
    answer:
      "Double staves. TKA was designed around them: each staff has two ends, one is your thumb reference and one is your pinky reference, and with proper technique those references never change. That is what makes prop orientation readable while you learn. Grab a pair of staves and start with the Level 1 guide.",
    cta: { label: "Follow the Level 1 guide", href: "/learn/guide" },
  },
  {
    question: "Does it work with my prop?",
    answer:
      "If you dual-wield it and grip it directly, yes. TKA is built for double staff and also supports clubs, fans, hoops, mini hoops, and buugeng, each rendered with proper rotations and hand positions. The spinner further up this page lets you switch between them live.",
    cta: { label: "Try props in the spinner", href: "/#play-with-it" },
  },
  {
    question: "Is Flow Arts Composer free?",
    answer:
      "Yes. Building sequences, animating them, and browsing the community library are free, and the core stays free. A premium tier is planned down the line to help sustain the project, but it isn't live yet.",
    cta: { label: "Start building", href: "/composer" },
  },
  {
    question: "Can I share what I make?",
    answer:
      "Yes. Export sequences as images, PDFs, animated GIFs, or videos, share a link straight to Instagram, or publish to the community gallery for other artists to find and remix.",
    cta: { label: "Open the composer", href: "/composer" },
  },
];

/**
 * Serialize the same items as schema.org FAQPage JSON-LD. Kept here (not in the
 * component) so the data and its structured-data shape never drift apart.
 */
export function faqPageJsonLd(items: FaqItem[] = FAQ_ITEMS): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  });
}
