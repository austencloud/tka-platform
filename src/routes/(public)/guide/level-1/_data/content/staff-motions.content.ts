import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/StaffMotionsPage.svelte (Austen's words — never AI-written).
export const staffMotionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Staff Motions" },

  { kind: "heading", level: 2, text: "Shift" },
  {
    kind: "prose",
    html: "During a shift, a prop can rotate in one of two directions - Prospin or Antispin",
  },

  { kind: "heading", level: 3, text: "Prospin" },
  {
    kind: "prose",
    html:
      "• <strong>Prospin</strong> - The prop rotates the same direction as the handpath<br>A 90 degree isolation is our base unit of a prospin.",
  },
  { kind: "prose", html: "In a base isolation, the thumb orientation remains the same for the entire motion." },

  { kind: "heading", level: 3, text: "Antispin" },
  {
    kind: "prose",
    html:
      "• <strong>Antispin</strong> - The prop rotates in the opposite direction of the handpath<br>A 90 degree antispin is our base unit of antispin.",
  },
  { kind: "prose", html: "In an antispin, the ends swap orientation. Here, it moves from thumb in to thumb out." },

  { kind: "heading", level: 2, text: "Dash" },
  { kind: "prose", html: "In a base dash, the thumb ends also swap orientation." },
  { kind: "prose", html: "Halfway through the motion, the center of the staff is at the grid’s center point." },
];
