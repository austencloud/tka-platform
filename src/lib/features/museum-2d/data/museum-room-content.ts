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

  // ── Phase 2: Order-era wings ──

  egyptian: {
    exhibits: {
      "egypt-karnak": {
        plaque: {
          title: "The Karnak Scrolls",
          subtitle: "c. 1470 BCE",
          body:
            "Hieroglyphic scrolls documenting the first formal Type classification system. " +
            "Six categories of movement, organized by hand path. " +
            "The priesthood controlled access to advanced notation.",
          footer: "Translated by the Cairo Institute, 1923",
        },
      },
      "egypt-priesthood": {
        plaque: {
          title: "Priesthood Display",
          body:
            "Temple scene: priests notating ceremonial movements on papyrus. " +
            "Access to the complete Type system required initiation into the inner circle. " +
            "Knowledge was power. Power was controlled.",
        },
      },
      "egypt-amphora": {
        plaque: {
          title: "Greek Amphora",
          subtitle: "c. 500 BCE",
          body:
            "Decorated pottery showing spinning figures. The Greeks inherited the system from Egypt " +
            "and applied mathematical rigor. Pythagoras recognized the relationships. " +
            "He founded a secret cult to study them.",
        },
      },
      "egypt-controlled": {
        plaque: {
          title: "Controlled Knowledge",
          body:
            "First evidence that access was deliberately restricted. " +
            "Temple records show notation scrolls stored separately from other documents, " +
            "with specialized access protocols.",
          footer: "NILE BUREAU — Classification: RESTRICTED",
        },
      },
    },
  },

  renaissance: {
    exhibits: {
      "ren-codex": {
        plaque: {
          title: "Codex Pages",
          subtitle: "c. 1500 CE",
          body:
            "Da Vinci's notebooks contain rotational diagrams that precisely match " +
            "the Kinetic Alphabet's position system. He decoded the Egyptian scrolls " +
            "and recast them as geometry.",
          footer: "Reproductions. Originals: scattered across seven collections.",
        },
      },
      "ren-vitruvian": {
        plaque: {
          title: "Vitruvian Man Analysis",
          body:
            "The famous image reinterpreted as a position diagram. " +
            "Arms and legs map to the eight cardinal and intercardinal points. " +
            "Da Vinci embedded the grid in the most famous drawing in history.",
        },
      },
      "ren-workshop": {
        plaque: {
          title: "Workshop Recreation",
          body:
            "Da Vinci's studio with scattered notes. " +
            "The notebooks were deliberately dispersed after his death. " +
            "By whom, and why, remains a matter of institutional record.",
        },
      },
      "ren-notebooks": {
        plaque: {
          title: "Notebooks Scattered",
          body:
            "After Leonardo's death in 1519, his notebooks were dispersed " +
            "across seven collections in five countries. The dispersal pattern matches " +
            "no known inheritance or sale. Someone wanted the complete system " +
            "to be unrecoverable.",
        },
      },
    },
  },

  victorian: {
    exhibits: {
      "vic-brass": {
        plaque: {
          title: "The Brass Notation Device",
          subtitle: "1871, London",
          body:
            "The only surviving prototype. A mechanical calculator that could " +
            "enumerate all possible four-beat sequences for a given starting position. " +
            "Patent recalled by the Home Office within six months of filing.",
          footer: "Inventor: [NAME REDACTED]",
        },
      },
      "vic-patents": {
        plaque: {
          title: "Patent Documents",
          body:
            "Seven patent applications related to kinetic notation, filed between 1868 and 1891. " +
            "Three marked RECALLED. Two marked APPLICATION DENIED. " +
            "One stamped with a symbol not yet catalogued by this archive.",
        },
      },
      "vic-portraits": {
        plaque: {
          title: "Inventor Portraits",
          body:
            "Several portraits of notable kinetic researchers. " +
            "One portrait has the nameplate replaced with NAME REDACTED. " +
            "The subject appears undisturbed by this.",
        },
      },
      "vic-discredited": {
        plaque: {
          title: "Discredited",
          body:
            "Key inventors were ruined by scandal. Anonymous complaints, funding reviews, " +
            "paper retractions. No violence. Just process. " +
            "The method is never explained in this archive.",
          footer: "See also: Containment Protocol 4-C (discrediting)",
        },
      },
    },
  },
};
