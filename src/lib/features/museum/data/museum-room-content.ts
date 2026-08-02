/**
 * Museum Room Content - Phase 1
 *
 * Exhibit plaque text, performer definitions, and trigger definitions
 * for each room. Keyed by room ID, then by refId within each category.
 *
 * This file contains the "meat" - the writing, the lore, the references.
 * The room graph defines where things go. This file defines what they say.
 */

export interface ExhibitContent {
  plaque: {
    title: string;
    subtitle?: string;
    body: string;
    barter?: string;
  };
  sequenceId?: string;
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
          barter: "Visiting hours: 24/7",
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
          barter: "Form 7741-A: Visitor Registration",
        },
      },
      "entrance-bulletin": {
        plaque: {
          title: "Staff Notice Board",
          body:
            "ALL STAFF: Badge access updated effective 11/14/1998. " +
            "Please collect new credentials from Room 114. " +
            "Fire drill scheduled for Friday. Attendance mandatory.",
          barter: "- Facilities Management",
        },
      },
      "entrance-reception": {
        plaque: {
          title: "Reception",
          subtitle: "Visitor Hours: By Appointment Only",
          body:
            "Please check in with the front desk before proceeding. " +
            "Unauthorized access beyond the lobby is prohibited. " +
            "All personal effects must be declared.",
          barter: "Department of Rotational Affairs",
        },
      },
    },
  },

  lobby: {
    exhibits: {
      "lobby-first-pictograph": {
        plaque: {
          title: "Primary Kinetic Notation",
          subtitle: "Orientation Plate 01",
          body:
            "This diagram is the standard visual unit used throughout the archive. " +
            "Visitors are asked to observe the indicated positions without imitating them. " +
            "Repeated exposure may produce an inaccurate sense that the movement can be " +
            "performed safely. It cannot. Continue to the historical galleries for " +
            "documented examples.",
          barter: "Department of Rotational Affairs · Reference 1-A",
        },
        sequenceId: "gallery-spiral-seq",
      },
      "lobby-reception": {
        plaque: {
          title: "Reception",
          subtitle: "Visitor Hours: By Appointment Only",
          body:
            "Please check in with the front desk before proceeding. " +
            "Unauthorized access beyond the lobby is prohibited. " +
            "All personal effects must be declared.",
          barter: "Department of Rotational Affairs",
        },
      },
      "lobby-gift-shop-frontage": {
        plaque: {
          title: "Museum Shop",
          subtitle: "Closed",
          body:
            "Catalog orders may be submitted at reception. Items displayed behind the " +
            "glass remain property of the Department until a numbered receipt has been " +
            "issued. Visitors returning from the galleries must present all carried " +
            "objects for comparison before departure.",
          barter: "Inventory review in progress",
        },
      },
      "lobby-bulletin": {
        plaque: {
          title: "Staff Notice Board",
          body:
            "ALL STAFF: Badge access updated effective 11/14/1998. " +
            "Please collect new credentials from Room 114. " +
            "Fire drill scheduled for Friday. Attendance mandatory.",
          barter: "- Facilities Management",
        },
      },
      "lobby-guest-book": {
        plaque: {
          title: "Guest Book",
          subtitle: "Please sign in",
          body:
            "All visitors must register with the front desk. " +
            "A valid government-issued ID is required for access " +
            "beyond the main gallery. Bags will be searched.",
          barter: "Form 7741-A: Visitor Registration",
        },
      },
    },
    performers: {
      "lobby-telekinetic-formation": {
        autoPlay: true,
        sequenceId: "gallery-spiral-seq",
      },
    },
  },

  "vulcan-cave": {
    exhibits: {
      "cave-lascaux-1": {
        plaque: {
          title: "Lascaux Tablets - Panel A",
          subtitle: "c. 15,000 BCE (estimated)",
          body:
            "Recovered from a secondary chamber at Lascaux in 1942. " +
            "The tablets depict a series of hand positions " +
            "arranged in a repeating sequence. Carbon dating places " +
            "them among the oldest known artifacts in this collection. " +
            "The notation system is immediately recognizable to modern analysts.",
          barter: "Acquisition: Order Field Team, Dordogne, 1942. Filing: KA-CAVE-001.",
        },
      },
      "cave-lascaux-2": {
        plaque: {
          title: "Lascaux Tablets - Panel B",
          subtitle: "c. 15,000 BCE (estimated)",
          body:
            "The second panel extends the sequence from Panel A into " +
            "what appears to be a complete choreographic phrase. " +
            "Note the reversal glyph at position 4. " +
            "The artist was describing a LOOP before the concept had a name.",
          barter: "Cross-reference: KA-CAVE-001b. See also: Wing 4, Patent 7741.",
        },
      },
      "cave-paintings-1": {
        plaque: {
          title: "Cave Wall Fragment - Kinetic Figures",
          subtitle: "Unknown date, pre-agricultural",
          body:
            "Silhouettes of two figures facing each other, each holding " +
            "elongated objects. The figures are drawn in four successive positions, " +
            "suggesting movement over time. " +
            "The objects are staves. The motion is unmistakable.",
          barter: "Recovered: North Africa, 1937. Classification: GRIPPED-BILATERAL.",
        },
      },
      "cave-paintings-2": {
        plaque: {
          title: "Cave Wall Fragment - Audience",
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
          barter: "Personnel file: MARCHAND-H. Status: INACTIVE.",
        },
      },
    },
    performers: {
      "cave-performer-1": {
        autoPlay: true,
        sequenceId: "performer-cave-seq",
      },
      "cave-performer-2": {
        autoPlay: true,
        sequenceId: "performer-cave-seq",
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
          barter: "Translated by the Cairo Institute, 1923",
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
          barter: "NILE BUREAU - Classification: RESTRICTED",
        },
      },
    },
    performers: {
      "egypt-telekinetic-formation": {
        autoPlay: true,
        sequenceId: "gallery-spiral-seq",
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
          barter: "Reproductions. Originals: scattered across seven collections.",
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
            "enumerate all possible four-step sequences for a given starting position. " +
            "Patent recalled by the Home Office within six months of filing.",
          barter: "Inventor: [NAME REDACTED]",
        },
        sequenceId: "vic-brass-seq",
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
          barter: "See also: Containment Protocol 4-C (discrediting)",
        },
      },
    },
  },

  // ── Phase 3: Digital + Suppression ──

  digital: {
    exhibits: {
      "digital-crt": {
        plaque: {
          title: "The CRT",
          subtitle: "1993",
          body:
            "The original terminal running TKA-OS v2. One of an estimated 3,400 copies " +
            "distributed before the Bureau detected the breach. " +
            "Press E to boot the system.",
          barter: "Serial: BKC-ASSET-7741",
        },
        sequenceId: "digital-crt-seq",
      },
      "digital-bbs": {
        plaque: {
          title: "BBS Printouts",
          body:
            "Forum posts from 1993-1994. Users sharing sequences, asking questions, " +
            "building on each other's work. The Bureau monitored these forums for eleven months " +
            "before requesting emergency powers.",
        },
      },
      "digital-3400": {
        plaque: {
          title: "3,400 Users",
          body:
            "The number that triggered the crisis. Internal memo: 'Distribution has exceeded " +
            "containment threshold. Recommend immediate execution of Protocol Lethe. " +
            "See attached requisition.'",
        },
      },
      "digital-team": {
        plaque: {
          title: "Development Team",
          body:
            "Grainy photograph. Faces obscured. One circled in red marker - added later, " +
            "not original to the print. The handwriting on the circle matches " +
            "no known Bureau personnel.",
        },
      },
    },
  },

  suppression: {
    exhibits: {
      "supp-order-1": {
        plaque: {
          title: "The Order of the Closed Palm",
          body:
            "Founded before recorded history. A hand with fingers curled inward - " +
            "not a fist, more like recoiling. The hand that refuses to grip. " +
            "The hand that will not hold a prop.",
        },
      },
      "supp-order-2": {
        plaque: {
          title: "Bureau of Kinetic Containment",
          body:
            "The modern name. American, 1940s. The transition from ancient mystic guardians " +
            "to government bureaucracy was gradual - decades of absorption, not a founding date. " +
            "Eventually: a budget line item and reporting requirements.",
          barter: "Department of Rotational Affairs, Facility 7",
        },
      },
      "supp-order-3": {
        plaque: {
          title: "Three Eras, One Mission",
          body:
            "Prehistoric: nameless, just a symbol repeated on cave walls. " +
            "Classical: Order of the Closed Palm, a named secret society. " +
            "Modern: Bureau of Kinetic Containment. " +
            "Observe. Archive. Revere. But never practice.",
        },
      },
      "supp-lethe": {
        plaque: {
          title: "Protocol Lethe Documentation",
          body:
            "Named for the Greek river of forgetting. An ancient bureaucratic procedure. " +
            "Requisition 7741-B submitted to three departments: Media Degaussing, " +
            "Cognitive Reclassification, Digital Archive Redaction. " +
            "Each processes independently. The Order follows a checklist they can barely read.",
        },
      },
      "supp-youve-seen": {
        plaque: {
          title: "You've Seen This Before",
          body:
            "The symbol in the cave ceiling. The wax seal on the Renaissance letter. " +
            "The stamp on the Victorian patent. The username in the BBS thread. " +
            "It was here the whole time. You just didn't know what you were looking at.",
        },
      },
      "supp-may8": {
        plaque: {
          title: "May 8, 1994",
          body:
            "Date of the final Protocol Lethe execution. The protocol was designed for " +
            "villages and monasteries. It cannot scale to eight billion people with broadband. " +
            "Ancient containment procedure versus YouTube.",
          barter: "Status: PARTIAL FAILURE - See Addendum 7741-F",
        },
      },
    },
  },

  "vtg-wing": {
    exhibits: {
      "vtg-renovation": {
        plaque: {
          title: "THE VULCAN WING",
          subtitle: "Documenting the Oakland School, 1990s–Present",
          body:
            "NOTICE: This exhibit has been under renovation since 2024. " +
            "We appreciate your patience. Estimated completion: [DATE NOT FOUND]. " +
            "Visitors interested in the Vulcan notation tradition are encouraged " +
            "to consult external resources.",
        },
      },
    },
  },

  // ── Phase 4: Post-Order rooms ──

  gallery: {
    exhibits: {
      "gallery-spiral": {
        plaque: {
          title: "The Spiral",
          body:
            "You've seen it throughout the museum. On floor tiles, in frame corners, " +
            "woven into decoration. Every spin is a spiral through time. " +
            "The Scribes didn't choose it. It chose them.",
          barter: "- K",
        },
        sequenceId: "gallery-spiral-seq",
      },
      "gallery-scribes": {
        plaque: {
          title: "The Scribes",
          body:
            "Not an organization. A pattern. People who picked up the thing and did it. " +
            "Sometimes they cluster into groups. Sometimes they're alone. " +
            "The Order documents them all.",
        },
        sequenceId: "gallery-scribes-seq",
      },
      "gallery-practice": {
        plaque: {
          title: "Practice",
          body:
            "The gap between 'I can see this is beautiful' and 'I can do this myself' " +
            "is the whole story. Forty thousand years of it.",
          barter: "- K",
        },
        sequenceId: "gallery-practice-seq",
      },
      "gallery-k-note": {
        plaque: {
          title: "Curator's Note",
          body:
            "This is my favorite room. I built it from what the Order left behind. " +
            "They had everything right except the padlock.",
          barter: "- K",
        },
      },
    },
    performers: {
      "gallery-scribe": { autoPlay: true, sequenceId: "gallery-spiral-seq" },
    },
  },

  fear: {
    exhibits: {
      "fear-containment-1": {
        plaque: {
          title: "CONTAINMENT PROTOCOL ACTIVE",
          body:
            "This knowledge is a public health hazard. Seal the archive. Walk away. " +
            "Authorized handling personnel only.",
          barter: "Bureau of Kinetic Containment - Form 7741-C",
        },
      },
      "fear-containment-2": {
        plaque: {
          title: "DO NOT ATTEMPT REPLICATION",
          body:
            "Exposure to kinetic notation has been classified as a Category 3 " +
            "cognitive hazard. Report symptoms immediately: temporal dissociation, " +
            "compulsive repetition, inability to release the object.",
        },
      },
      "fear-containment-3": {
        plaque: {
          title: "REPORT EXPOSURE",
          body:
            "If you have observed synchronized movement, gripped a prop-like object, " +
            "or experienced loss of time awareness during repetitive motion, " +
            "contact your regional monitor immediately.",
          barter: "Hotline: [NUMBER DISCONNECTED]",
        },
      },
    },
  },

  collaboration: {
    performers: {
      "collab-1": { autoPlay: true, sequenceId: "performer-cave-seq" },
      "collab-2": { autoPlay: true, sequenceId: "gallery-spiral-seq" },
      "collab-3": { autoPlay: true, sequenceId: "gallery-scribes-seq" },
      "collab-4": { autoPlay: true, sequenceId: "gallery-practice-seq" },
    },
  },

  // ── Phase 5: Final rooms ──

  "gift-shop": {
    performers: {
      "shop-cashier": { autoPlay: false },
    },
  },

  "construction-zone": {
    exhibits: {
      "cz-staff-only": {
        plaque: {
          title: "STAFF ONLY - EXHIBIT PREPARATION",
          body:
            "Authorized personnel beyond this point. Hard hat required. " +
            "Estimated completion of Wing 9: [DATE NOT FOUND].",
        },
      },
    },
  },

  janitor: {
    exhibits: {
      "janitor-whiteboard": {
        plaque: {
          title: "AUSTEN'S FAKE MUSEUM IDEAS",
          body:
            "- Cave wing with fake tablets (DONE)\n" +
            "- Egyptian wing (TODO: need more hieroglyphs)\n" +
            "- Gift shop w/ fake money mechanic\n" +
            "- Statues of myself?? (too much?)\n" +
            "- VTG wing (ask Noel first)\n" +
            "- Three endings like Scrooge\n" +
            "- Janitor's closet reveal (you are here)",
        },
      },
      "janitor-mannequin": {
        plaque: {
          title: "Mannequin",
          body:
            "A department store mannequin with a photograph of a face taped to it. " +
            "The photograph is slightly askew. The wig is worse.",
        },
      },
    },
  },
};
