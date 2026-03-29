/**
 * Museum Room Content — Phase 1
 *
 * Exhibit plaque text, performer definitions, and trigger definitions
 * for each room. Keyed by room ID, then by refId within each category.
 *
 * This file contains the "meat" — the writing, the lore, the references.
 * The room graph defines where things go. This file defines what they say.
 */

export interface ExhibitContent {
  plaque: {
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
  };
}

export interface PerformerContent {
  sequenceId?: string;
  autoPlay: boolean;
}

export interface RoomContentMap {
  exhibits?: Record<string, ExhibitContent>;
  performers?: Record<string, PerformerContent>;
}

/**
 * All room content, keyed by room ID.
 */
export const ROOM_CONTENT: Record<string, RoomContentMap> = {
  entrance: {
    exhibits: {
      "entrance-welcome": {
        plaque: {
          title: "Welcome to The Kinetic Archive",
          body:
            "Department of Rotational Affairs, Facility 7. " +
            "Please proceed through the exhibits in order. " +
            "Do not touch the artifacts. " +
            "Do not attempt to replicate what you see.",
          footer: "Visiting hours: 24/7",
        },
      },
      "entrance-guest-book": {
        plaque: {
          title: "Guest Book",
          subtitle: "Please sign in",
          body:
            "All visitors must register with the front desk. " +
            "A valid government-issued ID is required for access " +
            "beyond the main gallery. Bags will be searched.",
          footer: "Form 7741-A: Visitor Registration",
        },
      },
    },
  },

  "vulcan-cave": {
    exhibits: {
      "cave-lascaux-1": {
        plaque: {
          title: "Lascaux Tablets — Panel A",
          subtitle: "c. 15,000 BCE (estimated)",
          body:
            "Recovered from a secondary chamber at Lascaux in 1942. " +
            "The tablets depict a series of hand positions " +
            "arranged in a repeating sequence. Carbon dating places " +
            "them among the oldest known artifacts in this collection. " +
            "The notation system is immediately recognizable to modern analysts.",
          footer: "Acquisition: Order Field Team, Dordogne, 1942. Filing: KA-CAVE-001.",
        },
      },
      "cave-lascaux-2": {
        plaque: {
          title: "Lascaux Tablets — Panel B",
          subtitle: "c. 15,000 BCE (estimated)",
          body:
            "The second panel extends the sequence from Panel A into " +
            "what appears to be a complete choreographic phrase. " +
            "Note the reversal glyph at position 4. " +
            "The artist was describing a LOOP before the concept had a name.",
          footer: "Cross-reference: KA-CAVE-001b. See also: Wing 4, Patent 7741.",
        },
      },
      "cave-paintings-1": {
        plaque: {
          title: "Cave Wall Fragment — Kinetic Figures",
          subtitle: "Unknown date, pre-agricultural",
          body:
            "Silhouettes of two figures facing each other, each holding " +
            "elongated objects. The figures are drawn in four successive positions, " +
            "suggesting movement over time. " +
            "The objects are staves. The motion is unmistakable.",
          footer: "Recovered: North Africa, 1937. Classification: GRIPPED-BILATERAL.",
        },
      },
      "cave-paintings-2": {
        plaque: {
          title: "Cave Wall Fragment — Audience",
          subtitle: "Same site as adjacent panel",
          body:
            "A semicircle of smaller figures surrounds the two performers. " +
            "Several are seated. One appears to be drawing on the cave wall. " +
            "The first known depiction of someone watching flow arts " +
            "and taking notes.",
        },
      },
      "cave-marchand": {
        plaque: {
          title: "Dr. Henri Marchand",
          subtitle: "1889-1953. Order Archivist, First Class.",
          body:
            "Marchand spent 27 years cataloging pre-agricultural kinetic " +
            "artifacts across four continents. His field journals document " +
            "identical notation patterns appearing independently in " +
            "communities with no known contact. Marchand's conclusion: " +
            '"The sequences arrive. We merely record them." ' +
            "He was reassigned to Filing in 1951.",
          footer: "Personnel file: MARCHAND-H. Status: INACTIVE.",
        },
      },
    },
    performers: {
      "cave-performer-1": {
        autoPlay: true,
      },
      "cave-performer-2": {
        autoPlay: true,
      },
    },
  },
};
