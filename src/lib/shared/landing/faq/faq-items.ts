/**
 * The one canonical FAQ for the whole public site.
 *
 * Before this, the same questions lived in three drifting copies: the about
 * page's visible markup, the about page's FAQPage JSON-LD, and an orphaned
 * 9-item FAQPage schema on the landing route that had NO visible counterpart
 * (a Google policy violation: schema must match on-page content). A fourth,
 * divergent 4-item list sat dead in routes/landing/components/FAQSection.svelte.
 *
 * Now both /about and the landing page render `FaqAccordion`, which draws its
 * visible list AND its JSON-LD from this single array. Edit copy here once.
 */

export type FaqItem = { question: string; answer: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is The Kinetic Alphabet?",
    answer:
      "The Kinetic Alphabet (TKA) is notation for flow arts. It lets flow artists document, share, and learn prop choreography using pictographs and symbols, instead of relying on video alone.",
  },
  {
    question: "What does TKA stand for?",
    answer:
      "TKA stands for The Kinetic Alphabet, a flow arts notation system for documenting and sharing staff, club, fan, hoop, and buugeng choreography.",
  },
  {
    question: "What is flow arts notation?",
    answer:
      "Flow arts notation is a way to write down prop movement: staff, club, fan, and hoop choreography. The Kinetic Alphabet uses a pictograph for each beat, showing hand positions, motion type, and prop orientation.",
  },
  {
    question: "How is this different from other notation systems?",
    answer:
      "TKA builds on ideas from Vulcan Tech Gospel (VTG) and extends them into a visual, pictograph-based system. You can read a sequence immediately, without memorizing terminology first.",
  },
  {
    question: "Do I need to memorize the letter system?",
    answer:
      "No. The pictographs are readable on their own. The letter system is optional. It gives you a way to name and reference sequences once you want to go deeper.",
  },
  {
    question: "How do you write down staff spinning moves?",
    answer:
      "Each beat becomes a pictograph that captures hand positions on a grid, the motion type (pro, anti, static, dash), direction, and number of turns. TKA is built for dual-wielded props like double staff, and the notation applies to any prop you grip directly.",
  },
  {
    question: "What props does TKA Composer support?",
    answer:
      "TKA was built for double staff, and works with any dual-wielded static prop you grip directly, like clubs, fans, hoops, mini hoops, and buugeng. Each prop renders with proper rotations and hand positions.",
  },
  {
    question: "Is TKA Composer free to use?",
    answer:
      "Yes. The core of TKA Composer is free, and most of it will stay that way: build sequences, animate them, and browse the community library at no cost. Down the line, a few take-home extras may become premium to help sustain the project.",
  },
  {
    question: "How do I learn flow arts with The Kinetic Alphabet?",
    answer:
      "TKA Composer includes progressive lessons, from grid basics to advanced LOOPs. Interactive quizzes reinforce each idea, and daily challenges help you keep a streak going.",
  },
  {
    question: "Can I share my sequences with other flow artists?",
    answer:
      "Yes. Export sequences as images, PDFs, animated GIFs, or videos, share a link straight to Instagram, or publish to the community gallery for other artists to find.",
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
