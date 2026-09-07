/**
 * K's annotations — the second voice.
 *
 * DRAFT. Every line in this file is in-fiction text written for Austen's pass
 * (2026-09-04). Nothing here is final copy.
 *
 * The Archive has two voices and both are K: the narrator on the 1989–1993
 * audio guide, and the annotator who came back after 2008 with a marker and a
 * stack of sticky notes. This file is the marker. `PLAQUE_ANNOTATIONS` are the
 * notes stuck to Order surfaces (keyed by exhibit refId, merged onto the plaque
 * by the wall stamper). `FREE_ANNOTATIONS` are the notes with nothing to stick
 * to — cave chambers have no plaques, so K left them on posts.
 *
 * Voice rules (museum-writer): 25–30 words per note, one joke per surface, the
 * institution is never in on it, solo practitioners and K's own cracking are
 * never the joke. TKA terminology only. Elements are stamped, never spoken.
 */
import type { PlaqueAnnotation } from "../domain/museum-grid-types";

export const PLAQUE_ANNOTATIONS: Record<string, PlaqueAnnotation[]> = {
  // ── Lobby ──
  "entrance-welcome": [
    {
      text:
        "They kept the sign. They kept the hours. They kept everything " +
        "except the part where you're allowed to touch it. Come in anyway. — K",
      era: "final",
    },
  ],
  "entrance-guest-book": [
    {
      text:
        "Last signature before mine: 1994. Mine: 2008. Yours: today. " +
        "That's the whole visitor log. — K",
      era: "final",
    },
  ],
  "entrance-bulletin": [
    {
      text:
        "Orientation Plate 01, top right. Took me two years to notice it's mounted " +
        "upside down. Whoever installed it never had to read one.",
      era: "settled",
    },
  ],

  // ── Egypt ──
  "egypt-karnak": [
    {
      text:
        "The Bureau's photo of this wall is cropped. Left third missing. " +
        "The left third is where the second person is standing.",
      era: "established",
    },
  ],
  "egypt-controlled": [
    {
      text:
        "'Controlled context.' A temple courtyard is a controlled context " +
        "the way a kitchen is a controlled fire.",
      era: "settled",
    },
  ],
  "egypt-amphora": [
    {
      text:
        "Two figures, one clay pot. Whoever painted it had watched it done. " +
        "You don't invent that hand position.",
      era: "settled",
    },
  ],

  // ── Renaissance ──
  "ren-notebooks": [
    {
      text:
        "Mirror writing. Every account says he did it to hide things. He did " +
        "it because he was left-handed and ink smears. The Order cites the first reason.",
      era: "established",
    },
  ],
  "ren-vitruvian": [
    {
      text:
        "They call it proportion. Put a staff in each hand and it's a start " +
        "position. He drew the warm-up.",
      era: "settled",
    },
  ],

  // ── Victorian ──
  "vic-discredited": [
    {
      text:
        "Discredited by whom? The footnote cites a Bureau report. " +
        "The report cites this plaque.",
      era: "established",
    },
  ],
  "vic-patents": [
    {
      text:
        "Patent No. 14,206: 'Apparatus for the Safe Retention of Rotating " +
        "Implements.' It's a hand. They patented a hand.",
      era: "settled",
    },
  ],

  // ── Digital ──
  "digital-bbs": [
    {
      text:
        "Username on the thread: closedpalm_admin. Posting from a government " +
        "address at 2 a.m., asking everyone to please stop.",
      era: "established",
    },
  ],
  "digital-team": [
    {
      text:
        "Back row, third from left. The caption names everyone else. " +
        "Read the Bellweather report before you decide what that means.",
      era: "final",
    },
  ],

  // ── Suppression ──
  "supp-order-1": [
    {
      text:
        "Not a fist. Recoiling. They got that right. It's the hand of someone " +
        "who's been handed something and doesn't know what to do with it.",
      era: "settled",
    },
  ],
  "supp-order-2": [
    {
      text:
        "Department of Rotational Affairs, Facility 7. I had the desk by the " +
        "window. The window faced a wall.",
      era: "established",
    },
  ],
  "supp-order-3": [
    {
      text:
        "Observe. Archive. Revere. Never practice. Three verbs and a padlock. " +
        "The padlock did all the work.",
      era: "settled",
    },
  ],
  "supp-lethe": [
    {
      text:
        "Requisition 7741-B. The 'Media Degaussing' line has my initials on it. " +
        "I was twenty-four.",
      era: "final",
    },
  ],
  "supp-youve-seen": [
    {
      text:
        "You've seen it. So had I. It took the badge on my own lanyard " +
        "for me to look down.",
      era: "settled",
    },
  ],
  "supp-may8": [
    {
      text: "PARTIAL FAILURE. The partial part is you, reading this.",
      era: "final",
    },
  ],
  "supp-bellweather": [
    {
      text:
        "Never adopted. Never denied. They filed it. " +
        "Filing was the only verb they had left.",
      era: "established",
    },
  ],

  // ── VTG wing ──
  "vtg-renovation": [
    {
      text:
        "Under renovation since 2024. Some things stay unbuilt on purpose. " +
        "Ask the people who'd have to build it.",
      era: "settled",
    },
  ],

  // ── Cross-Reference ──
  "xref-order": [
    {
      text: "They keep looking for what it says. They never asked what it IS.",
      era: "final",
    },
  ],
  "xref-memo": [
    {
      text:
        "Sixty-one revisions. Every one found the same six shapes. They were " +
        "right every time. They thought 'right' meant 'finished.'",
      era: "established",
    },
  ],

  // ── Fear ──
  "fear-containment-1": [
    {
      text:
        "Seal the archive. Walk away. I managed the second part for nine years. " +
        "The first part they did for me.",
      era: "established",
    },
  ],
  "fear-containment-2": [
    {
      text:
        "Temporal dissociation, compulsive repetition, inability to release " +
        "the object. Also known as: getting good at something.",
      era: "settled",
    },
  ],
  "fear-containment-3": [
    {
      text:
        "Hotline disconnected 1994. I called it anyway in 2009. It rang. " +
        "Nobody answered. That's the whole Bureau in one sentence.",
      era: "established",
    },
  ],
  "fear-final-argument": [
    {
      text: "They were right about one thing. It IS easy. — K",
      era: "final",
    },
  ],

  // ── Gift shop ──
  "shop-shelf-3": [
    {
      text: "Take them. Seriously. — K",
      era: "final",
    },
  ],

  // ── Construction zone ──
  "cz-staff-only": [
    {
      text:
        "Wing 9. There is no Wing 9. There has never been a Wing 9. " +
        "The hard hat is real.",
      era: "settled",
    },
  ],
};

/**
 * A note with nothing to stick to. Placed at a fraction of the room's bounds
 * (−0.5..0.5 from the room centre, same frame as furniture) on a short post
 * the visitor reads up close.
 */
export interface FreeAnnotation {
  id: string;
  roomId: string;
  offsetX: number;
  offsetY: number;
  /** Yaw in radians; 0 faces south (+Z). */
  yaw?: number;
  text: string;
  era?: PlaqueAnnotation["era"];
}

export const FREE_ANNOTATIONS: FreeAnnotation[] = [
  {
    id: "note-threshold",
    roomId: "cave-threshold",
    offsetX: -0.3,
    offsetY: 0.2,
    yaw: Math.PI / 2,
    text:
      "They put the ropes back every morning for five years. " +
      "I took them down every night. — K",
    era: "early",
  },
  // The tablets the threshold gallery used to hold went to Facility 7. K's
  // notes about them stayed, on posts, where the cases were.
  {
    id: "note-squeeze",
    roomId: "cave-squeeze",
    offsetX: 0.1,
    offsetY: -0.25,
    yaw: Math.PI,
    text:
      "There was a tablet here. REPLICA, the label said. The original is in " +
      "a drawer in Facility 7. I've seen the drawer. — K",
    era: "established",
  },
  {
    id: "note-marchand",
    roomId: "cave-water-gallery",
    offsetX: -0.25,
    offsetY: 0.15,
    yaw: Math.PI / 2,
    text:
      "Marchand studied the figures for eleven years and filed them under " +
      "'ritual.' Hold two sticks and try it. Takes about a minute. — K",
    era: "settled",
  },
  {
    id: "note-water",
    roomId: "cave-water",
    offsetX: -0.36,
    offsetY: 0.3,
    yaw: Math.PI / 4,
    text: "The water's real. The 'do not enter' isn't. — K",
    era: "early",
  },
  {
    id: "note-fire",
    roomId: "cave-fire",
    offsetX: 0.3,
    offsetY: 0.32,
    yaw: -Math.PI / 4,
    text:
      "Left figure: watch the wrist, not the staff. " +
      "That's the whole lesson. — K",
    era: "early",
  },
  {
    id: "note-earth",
    roomId: "cave-earth",
    offsetX: -0.28,
    offsetY: 0.3,
    yaw: Math.PI / 6,
    text:
      "This was a filing room in 1989. " +
      "I like it better with the roof off. — K",
    era: "settled",
  },
  {
    id: "note-air",
    roomId: "cave-air",
    offsetX: 0.28,
    offsetY: 0.3,
    yaw: -Math.PI / 6,
    text: "The updraft is real. Don't fight it. Same rule as the sequence. — K",
    era: "settled",
  },
  {
    id: "note-sun",
    roomId: "cave-sun",
    offsetX: -0.3,
    offsetY: 0.34,
    yaw: Math.PI / 5,
    text:
      "Read it from the ledge. They roped off the only place " +
      "you can see it from. — K",
    era: "settled",
  },
  {
    id: "note-moon",
    roomId: "cave-moon",
    offsetX: 0.3,
    offsetY: 0.34,
    yaw: -Math.PI / 5,
    text: "Three cases. The fourth spot is the hole. Stand in it. — K",
    era: "settled",
  },
  {
    id: "note-crumble",
    roomId: "crumble",
    offsetX: 0.25,
    offsetY: 0,
    yaw: -Math.PI / 2,
    text:
      "Nothing to read here. This is what 'approval pending' " +
      "looks like after twenty-three years. — K",
    era: "established",
  },
];
