/**
 * Proof text runs for manifest pages that faithfully correspond to a page in the
 * original proof PDF (static/guides/_proof/level-1-v05.pdf). GENERATED — do not
 * hand-edit; regenerate from scripts if the proof changes. Coordinates are the
 * proof's own points (top-left origin, 612×792pt sheet); the renderer scales by
 * 816/612. The page title is intentionally omitted (GuidePage renders it from
 * the manifest). Images/pictographs are NOT here — text only, for now.
 */
export type ProofRun = {
  x: number;
  y: number;
  w: number;
  fs: number;
  s: "regular" | "bold" | "italic" | "bolditalic" | "heading";
  t: string;
};

export const PROOF_TEXT: Record<string, ProofRun[]> = {
  "hm-type1": [
    {
      "x": 98.3,
      "y": 68.5,
      "w": 338.7,
      "fs": 14,
      "s": "regular",
      "t": "When both hands move to adjacent locations, it’s called a"
    },
    {
      "x": 440.1,
      "y": 68.5,
      "w": 64,
      "fs": 14,
      "s": "bold",
      "t": "Dual-Shift"
    },
    {
      "x": 504.1,
      "y": 68.5,
      "w": 2.9,
      "fs": 14,
      "s": "regular",
      "t": "."
    },
    {
      "x": 47.2,
      "y": 85.3,
      "w": 50.4,
      "fs": 14,
      "s": "regular",
      "t": "Our first"
    },
    {
      "x": 100.7,
      "y": 85.3,
      "w": 70.4,
      "fs": 14,
      "s": "bold",
      "t": "Dual-Shifts"
    },
    {
      "x": 174.1,
      "y": 85.3,
      "w": 384,
      "fs": 14,
      "s": "regular",
      "t": "correspond to the four modes of timing/direction: SS, TS, SO, TO."
    },
    {
      "x": 52.8,
      "y": 102.1,
      "w": 499.8,
      "fs": 14,
      "s": "regular",
      "t": "You can determine the start position by looking at the non-pointed end of the arrow."
    },
    {
      "x": 93.7,
      "y": 712.9,
      "w": 157.8,
      "fs": 14,
      "s": "regular",
      "t": "Notice that it can be either"
    },
    {
      "x": 254.5,
      "y": 712.9,
      "w": 54,
      "fs": 14,
      "s": "italic",
      "t": "Split-Opp"
    },
    {
      "x": 311.6,
      "y": 712.9,
      "w": 13.2,
      "fs": 14,
      "s": "regular",
      "t": "or"
    },
    {
      "x": 327.9,
      "y": 712.9,
      "w": 49.4,
      "fs": 14,
      "s": "italic",
      "t": "Tog-Opp"
    },
    {
      "x": 380.4,
      "y": 712.9,
      "w": 167.9,
      "fs": 14,
      "s": "regular",
      "t": "depending on start position."
    },
    {
      "x": 86.1,
      "y": 746.5,
      "w": 469.7,
      "fs": 14,
      "s": "bold",
      "t": "Practice using Dual-Shifts to travel between Alpha and Beta in each mode."
    },
    {
      "x": 117.5,
      "y": 383.6,
      "w": 397.5,
      "fs": 14,
      "s": "regular",
      "t": "The Kinetic Alphabet puts focus on simultaneous motions between"
    },
    {
      "x": 192.1,
      "y": 400.4,
      "w": 248.3,
      "fs": 14,
      "s": "regular",
      "t": "two positions, relative to the center point."
    },
    {
      "x": 209.6,
      "y": 417.2,
      "w": 143.3,
      "fs": 14,
      "s": "regular",
      "t": "Let’s try another type of"
    },
    {
      "x": 356.1,
      "y": 417.2,
      "w": 64,
      "fs": 14,
      "s": "bold",
      "t": "Dual-Shift"
    },
    {
      "x": 420,
      "y": 417.2,
      "w": 2.9,
      "fs": 14,
      "s": "regular",
      "t": "."
    },
    {
      "x": 173.2,
      "y": 434,
      "w": 286.2,
      "fs": 14,
      "s": "regular",
      "t": "What happens when we move between α and β?"
    },
    {
      "x": 12.7,
      "y": 190.2,
      "w": 70.6,
      "fs": 16,
      "s": "italic",
      "t": "Split-Same"
    },
    {
      "x": 15.3,
      "y": 308.2,
      "w": 65.4,
      "fs": 16,
      "s": "italic",
      "t": "Tog-Same"
    },
    {
      "x": 21.4,
      "y": 627.9,
      "w": 56.5,
      "fs": 16,
      "s": "italic",
      "t": "Tog-Opp"
    },
    {
      "x": 19.4,
      "y": 511.6,
      "w": 61.7,
      "fs": 16,
      "s": "italic",
      "t": "Split-Opp"
    }
  ],
  "staff-positions": [
    {
      "x": 51.8,
      "y": 74,
      "w": 510,
      "fs": 15,
      "s": "regular",
      "t": "When writing sequences with staves, it helps to mark the thumb end with a line."
    },
    {
      "x": 20.9,
      "y": 92,
      "w": 571.8,
      "fs": 15,
      "s": "regular",
      "t": "The performer can use it to keep track of rotations and check their position on every beat."
    },
    {
      "x": 77.8,
      "y": 110,
      "w": 458,
      "fs": 15,
      "s": "regular",
      "t": "It also encourages negative space/body turns instead of finger spinning."
    },
    {
      "x": 107.7,
      "y": 146,
      "w": 398.1,
      "fs": 15,
      "s": "regular",
      "t": "In the following examples, an end is always at the center point."
    },
    {
      "x": 60.8,
      "y": 182,
      "w": 491.9,
      "fs": 15,
      "s": "bold",
      "t": "Practice each position below, paying attention to the thumb orientation."
    },
    {
      "x": 79.7,
      "y": 660.4,
      "w": 454.4,
      "fs": 16,
      "s": "regular",
      "t": "Many of pictographs in this guide are depicted with no thumb ends"
    },
    {
      "x": 94.1,
      "y": 679.6,
      "w": 425.7,
      "fs": 16,
      "s": "regular",
      "t": "when categorizating. It is usually noted only during sequences."
    },
    {
      "x": 83.5,
      "y": 718,
      "w": 446.7,
      "fs": 16,
      "s": "regular",
      "t": "Most sequences in this guide start with thumbs in for consistency."
    },
    {
      "x": 55.9,
      "y": 737.2,
      "w": 502,
      "fs": 16,
      "s": "regular",
      "t": "It’s equally valid to start any sequence from a different thumb orientation."
    },
    {
      "x": 150,
      "y": 231.4,
      "w": 14.2,
      "fs": 17,
      "s": "regular",
      "t": "in"
    },
    {
      "x": 36.1,
      "y": 231.4,
      "w": 64.1,
      "fs": 17,
      "s": "regular",
      "t": "Thumbs:"
    },
    {
      "x": 44.5,
      "y": 341.9,
      "w": 42.3,
      "fs": 17,
      "s": "regular",
      "t": "Alpha"
    },
    {
      "x": 49.3,
      "y": 477.8,
      "w": 32.7,
      "fs": 17,
      "s": "regular",
      "t": "Beta"
    },
    {
      "x": 38,
      "y": 608.7,
      "w": 55.3,
      "fs": 17,
      "s": "regular",
      "t": "Gamma"
    },
    {
      "x": 265.1,
      "y": 231.4,
      "w": 24.2,
      "fs": 17,
      "s": "regular",
      "t": "out"
    },
    {
      "x": 489.3,
      "y": 231.2,
      "w": 59.7,
      "fs": 17,
      "s": "regular",
      "t": "(in/out)"
    },
    {
      "x": 368.7,
      "y": 231.4,
      "w": 59.7,
      "fs": 17,
      "s": "regular",
      "t": "(out/in)"
    }
  ],
  "staff-motions": [
    {
      "x": 277.6,
      "y": 58.9,
      "w": 53.4,
      "fs": 30,
      "s": "heading",
      "t": "Shift"
    },
    {
      "x": 276.1,
      "y": 584.2,
      "w": 56.4,
      "fs": 30,
      "s": "heading",
      "t": "Dash"
    },
    {
      "x": 114.5,
      "y": 426.2,
      "w": 32,
      "fs": 16,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 223.4,
      "y": 426.2,
      "w": 53.4,
      "fs": 16,
      "s": "italic",
      "t": "halfway"
    },
    {
      "x": 357.6,
      "y": 426.2,
      "w": 24.3,
      "fs": 16,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 11.9,
      "y": 139.8,
      "w": 63.5,
      "fs": 20,
      "s": "italic",
      "t": "Prospin"
    },
    {
      "x": 11.9,
      "y": 371.9,
      "w": 68.9,
      "fs": 20,
      "s": "italic",
      "t": "Antispin"
    },
    {
      "x": 27.4,
      "y": 326.7,
      "w": 553.9,
      "fs": 16,
      "s": "regular",
      "t": "In a base isolation, the thumb orientation remains the same for the entire motion."
    },
    {
      "x": 95.2,
      "y": 372.4,
      "w": 7.1,
      "fs": 16,
      "s": "regular",
      "t": "•"
    },
    {
      "x": 105.8,
      "y": 372.4,
      "w": 62.5,
      "fs": 16,
      "s": "bold",
      "t": "Antispin"
    },
    {
      "x": 171.8,
      "y": 372.4,
      "w": 404.6,
      "fs": 16,
      "s": "regular",
      "t": "- The prop rotates in the opposite direction of the handpath"
    },
    {
      "x": 95.2,
      "y": 391.6,
      "w": 328.2,
      "fs": 16,
      "s": "regular",
      "t": "A 90 degree antispin is our base unit of antispin."
    },
    {
      "x": 16.1,
      "y": 555,
      "w": 579.8,
      "fs": 16,
      "s": "regular",
      "t": "In an antispin, the ends swap orientation. Here, it moves from thumb in to thumb out."
    },
    {
      "x": 125,
      "y": 622.2,
      "w": 363.4,
      "fs": 16,
      "s": "regular",
      "t": "In a base dash, the thumb ends also swap orientation."
    },
    {
      "x": 38.9,
      "y": 480.4,
      "w": 24,
      "fs": 12,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 28.3,
      "y": 494.8,
      "w": 45.1,
      "fs": 12,
      "s": "italic",
      "t": "thumb in"
    },
    {
      "x": 561.1,
      "y": 480.4,
      "w": 18.2,
      "fs": 12,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 544.1,
      "y": 494.8,
      "w": 52,
      "fs": 12,
      "s": "italic",
      "t": "thumb out"
    },
    {
      "x": 114.5,
      "y": 190.8,
      "w": 32,
      "fs": 16,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 223.4,
      "y": 190.8,
      "w": 53.4,
      "fs": 16,
      "s": "italic",
      "t": "halfway"
    },
    {
      "x": 357.6,
      "y": 190.8,
      "w": 24.3,
      "fs": 16,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 95.2,
      "y": 141.9,
      "w": 6.6,
      "fs": 15,
      "s": "regular",
      "t": "•"
    },
    {
      "x": 105.1,
      "y": 141.9,
      "w": 54.1,
      "fs": 15,
      "s": "bold",
      "t": "Prospin"
    },
    {
      "x": 165.8,
      "y": 141.9,
      "w": 342.8,
      "fs": 15,
      "s": "regular",
      "t": "- The prop rotates the same direction as the handpath"
    },
    {
      "x": 95.2,
      "y": 159.9,
      "w": 319,
      "fs": 15,
      "s": "regular",
      "t": "A 90 degree isolation is our base unit of a prospin."
    },
    {
      "x": 38.9,
      "y": 245,
      "w": 24,
      "fs": 12,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 28.3,
      "y": 259.4,
      "w": 45.1,
      "fs": 12,
      "s": "italic",
      "t": "thumb in"
    },
    {
      "x": 561.1,
      "y": 244.3,
      "w": 18.2,
      "fs": 12,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 547.6,
      "y": 258.7,
      "w": 45.1,
      "fs": 12,
      "s": "italic",
      "t": "thumb in"
    },
    {
      "x": 114.5,
      "y": 642.6,
      "w": 32,
      "fs": 16,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 223.4,
      "y": 642.6,
      "w": 53.4,
      "fs": 16,
      "s": "italic",
      "t": "halfway"
    },
    {
      "x": 357.6,
      "y": 642.6,
      "w": 24.3,
      "fs": 16,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 38.9,
      "y": 695,
      "w": 24,
      "fs": 12,
      "s": "italic",
      "t": "start"
    },
    {
      "x": 28.3,
      "y": 709.4,
      "w": 45.1,
      "fs": 12,
      "s": "italic",
      "t": "thumb in"
    },
    {
      "x": 561.1,
      "y": 695,
      "w": 18.2,
      "fs": 12,
      "s": "italic",
      "t": "end"
    },
    {
      "x": 544.1,
      "y": 709.4,
      "w": 52,
      "fs": 12,
      "s": "italic",
      "t": "thumb out"
    },
    {
      "x": 41.6,
      "y": 101.1,
      "w": 525.6,
      "fs": 16,
      "s": "regular",
      "t": "During a shift, a prop can rotate in one of two directions - Prospin or Antispin"
    },
    {
      "x": 39.7,
      "y": 766.7,
      "w": 532.7,
      "fs": 16,
      "s": "regular",
      "t": "Halfway through the motion, the center of the staff is at the grid’s center point."
    }
  ],
  "negative-space": [
    {
      "x": 17.4,
      "y": 59.5,
      "w": 572.3,
      "fs": 14,
      "s": "regular",
      "t": "Many sequences seem impossible, but most can be solved by using negative space or body turns."
    },
    {
      "x": 91.4,
      "y": 76.3,
      "w": 93.7,
      "fs": 14,
      "s": "bolditalic",
      "t": "Negative space"
    },
    {
      "x": 188.2,
      "y": 76.3,
      "w": 327.6,
      "fs": 14,
      "s": "regular",
      "t": "lets you face the audience and reduces body movement"
    },
    {
      "x": 75.2,
      "y": 93.1,
      "w": 68.3,
      "fs": 14,
      "s": "bolditalic",
      "t": "Body turns"
    },
    {
      "x": 146.6,
      "y": 93.1,
      "w": 385.4,
      "fs": 14,
      "s": "regular",
      "t": "add movement and help you execute patterns with longer staves."
    },
    {
      "x": 72,
      "y": 109.9,
      "w": 463.1,
      "fs": 14,
      "s": "regular",
      "t": "Each method is equally important, and learning both will maximize capability."
    },
    {
      "x": 90,
      "y": 126.7,
      "w": 427.2,
      "fs": 14,
      "s": "regular",
      "t": "This guide will assume some knowledge of these fundamental concepts."
    },
    {
      "x": 41.9,
      "y": 160.3,
      "w": 523.4,
      "fs": 14,
      "s": "regular",
      "t": "To make the most of the Alphabet, it’s highly recommended that you learn the following."
    },
    {
      "x": 88.5,
      "y": 626.9,
      "w": 430.1,
      "fs": 14,
      "s": "regular",
      "t": "To execute this in wall plane, you must do one of the following on beat 2:"
    },
    {
      "x": 11.7,
      "y": 660.5,
      "w": 508.2,
      "fs": 14,
      "s": "regular",
      "t": "• Pass the thumb end through the negative space above your right shoulder on beat 2."
    },
    {
      "x": 11.7,
      "y": 677.3,
      "w": 581.8,
      "fs": 14,
      "s": "regular",
      "t": "• Turn your torso to the left on beat 2 and pass the thumb end in front, then pass the pinky end on"
    },
    {
      "x": 11.7,
      "y": 694.1,
      "w": 298,
      "fs": 14,
      "s": "regular",
      "t": "the inside of your right arm as you move to beat 3."
    },
    {
      "x": 107.1,
      "y": 727.7,
      "w": 393,
      "fs": 14,
      "s": "bold",
      "t": "Practice in reverse, then do both directions in the other hand."
    },
    {
      "x": 112.5,
      "y": 744.5,
      "w": 382.2,
      "fs": 14,
      "s": "bold",
      "t": "Then practice everything again starting with the thumb out."
    },
    {
      "x": 138.6,
      "y": 761.3,
      "w": 329.9,
      "fs": 14,
      "s": "bold",
      "t": "Try using both negative space and turns. Good luck!"
    },
    {
      "x": 208.4,
      "y": 474.7,
      "w": 177,
      "fs": 30,
      "s": "heading",
      "t": "4-Petal Antispin"
    },
    {
      "x": 48.9,
      "y": 350.9,
      "w": 522.3,
      "fs": 14,
      "s": "regular",
      "t": "To execute this without finger-spinning, turn your torso to the left on beat 3. During this"
    },
    {
      "x": 12.9,
      "y": 367.7,
      "w": 572.4,
      "fs": 14,
      "s": "regular",
      "t": "beat, the staff moves briefly in wheel-plane relative to your left-facing view. On beat 4, turn your"
    },
    {
      "x": 12.9,
      "y": 384.5,
      "w": 323.2,
      "fs": 14,
      "s": "regular",
      "t": "body back to center as you return to the start position."
    },
    {
      "x": 107.1,
      "y": 418.1,
      "w": 393,
      "fs": 14,
      "s": "bold",
      "t": "Practice in reverse, then do both directions in the other hand."
    },
    {
      "x": 111.6,
      "y": 434.9,
      "w": 384,
      "fs": 14,
      "s": "bold",
      "t": "Then practice it with the thumb out, isolating the pinky end."
    },
    {
      "x": 225.2,
      "y": 193.9,
      "w": 153.6,
      "fs": 30,
      "s": "heading",
      "t": "360° Isolation"
    },
    {
      "x": 532.4,
      "y": 3.8,
      "w": 70.3,
      "fs": 20,
      "s": "italic",
      "t": "VTG: 1:1"
    }
  ],
  "words": [
    {
      "x": 140.9,
      "y": 50,
      "w": 332,
      "fs": 15,
      "s": "regular",
      "t": "Let’s create more complex words using pictographs!"
    },
    {
      "x": 55.1,
      "y": 77.6,
      "w": 503.7,
      "fs": 15,
      "s": "regular",
      "t": "In order to perform the words in this section correctly without finger-spinning,"
    },
    {
      "x": 125.2,
      "y": 95.6,
      "w": 363.4,
      "fs": 15,
      "s": "regular",
      "t": "you must be familiar with negative space and body turns."
    },
    {
      "x": 71.5,
      "y": 123.2,
      "w": 470.8,
      "fs": 15,
      "s": "regular",
      "t": "If you finger-spin instead of using negative space, you’ll lose precision and"
    },
    {
      "x": 36.7,
      "y": 141.2,
      "w": 540.4,
      "fs": 15,
      "s": "regular",
      "t": "the ability to check your thumb orientation on each beat to see if you’re still on track."
    },
    {
      "x": 22.8,
      "y": 168.8,
      "w": 568.2,
      "fs": 15,
      "s": "regular",
      "t": "We’ll use the word AABB as an example. Here are three variations on AABB, starting from"
    },
    {
      "x": 70.5,
      "y": 186.8,
      "w": 273.1,
      "fs": 15,
      "s": "regular",
      "t": "different thumb orientations. Use staves or"
    },
    {
      "x": 346.9,
      "y": 186.8,
      "w": 61.6,
      "fs": 15,
      "s": "bold",
      "t": "red/blue"
    },
    {
      "x": 411.8,
      "y": 186.8,
      "w": 131.5,
      "fs": 15,
      "s": "regular",
      "t": "pens to follow along."
    },
    {
      "x": 7.8,
      "y": 547,
      "w": 596.4,
      "fs": 15,
      "s": "regular",
      "t": "As you execute these with staves, notice that each of these sequences requires a different type"
    },
    {
      "x": 76.4,
      "y": 565,
      "w": 459.3,
      "fs": 15,
      "s": "regular",
      "t": "of negative space, either above/below the shoulder or behind the elbow."
    },
    {
      "x": 47.9,
      "y": 601,
      "w": 552.2,
      "fs": 15,
      "s": "regular",
      "t": "The execution of the same word can feel completely different depending on factors like"
    },
    {
      "x": 24.9,
      "y": 619,
      "w": 562.2,
      "fs": 15,
      "s": "regular",
      "t": "the start position, rotation direction, and thumb orientation. That’s why it’s necessary to"
    },
    {
      "x": 112.9,
      "y": 637,
      "w": 386.3,
      "fs": 15,
      "s": "regular",
      "t": "draw the full sequence with pictographs for complete clarity."
    },
    {
      "x": 134.2,
      "y": 673,
      "w": 255.8,
      "fs": 15,
      "s": "bold",
      "t": "The Alphabet is primarily a system of"
    },
    {
      "x": 393.3,
      "y": 673,
      "w": 81,
      "fs": 15,
      "s": "bolditalic",
      "t": "pictographs"
    },
    {
      "x": 474.3,
      "y": 673,
      "w": 3.5,
      "fs": 15,
      "s": "bold",
      "t": ","
    },
    {
      "x": 128.8,
      "y": 691,
      "w": 354.4,
      "fs": 15,
      "s": "bold",
      "t": "organized by letters for convenient communication."
    },
    {
      "x": 65.1,
      "y": 727,
      "w": 517.9,
      "fs": 15,
      "s": "regular",
      "t": "The letters do not give all of the information, and are merely intended to separate"
    },
    {
      "x": 8.1,
      "y": 745,
      "w": 595.8,
      "fs": 15,
      "s": "regular",
      "t": "motion combinations into categories which can be further clarified with detailed pictographs."
    },
    {
      "x": 14.6,
      "y": 225.3,
      "w": 50.7,
      "fs": 14,
      "s": "italic",
      "t": "Thumbs"
    },
    {
      "x": 18.9,
      "y": 271.1,
      "w": 42.1,
      "fs": 14,
      "s": "bolditalic",
      "t": "in | in"
    },
    {
      "x": 9.1,
      "y": 366.6,
      "w": 61.2,
      "fs": 14,
      "s": "bolditalic",
      "t": "out | out"
    },
    {
      "x": 13.9,
      "y": 466.6,
      "w": 51.6,
      "fs": 14,
      "s": "bolditalic",
      "t": "in | out"
    }
  ]
};
