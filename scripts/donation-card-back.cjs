// Builds the donation card BACK artwork as a high-res PNG.
// A gifting card game: a warm heading, two essential steps, a closing line.
// Calligraphic title (Monotype Corsiva) + serif body (Georgia), matching the
// front. Rainbow border is applied later by the 4-up print script.
const sharp = require("sharp");

const DIR = "E:/tka-platform/static/donation";
const IN_W_PT = 264, IN_H_PT = 354;
const SCALE = 12;
const W = Math.round(IN_W_PT * SCALE);
const H = Math.round(IN_H_PT * SCALE);

(async () => {
  const cx = W / 2;
  const PADX = Math.round(W * 0.08);

  const TITLE = "Monotype Corsiva";
  const BODY = "Georgia";

  const headSize = Math.round(W * 0.11);
  const headY = Math.round(H * 0.13);

  const introSize = Math.round(W * 0.046);
  const introY = headY + Math.round(headSize * 1.15);

  // Two steps, each: number badge + bold label + supporting line.
  const stepNumSize = Math.round(W * 0.115);
  const stepLabelSize = Math.round(W * 0.058);
  const stepSubSize = Math.round(W * 0.044);

  const step1Y = introY + Math.round(H * 0.105);
  const step2Y = step1Y + Math.round(H * 0.235);

  const closeSize = Math.round(W * 0.05);
  const closeY = step2Y + Math.round(H * 0.205);
  const signY = closeY + Math.round(closeSize * 2.2);

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // numeral hangs at left margin; text block sits to its right
  const numX = PADX + Math.round(W * 0.02);
  const txtX = PADX + Math.round(W * 0.16);
  const txtRight = W - PADX;
  const txtW = txtRight - txtX;

  function step(y, num, label, sub1, sub2) {
    return `
    <text x="${numX}" y="${y + stepNumSize * 0.36}" font-family="${TITLE}" font-size="${stepNumSize}" fill="#6600cc" text-anchor="middle">${num}</text>
    <text x="${txtX}" y="${y}" font-family="${BODY}" font-size="${stepLabelSize}" font-weight="bold" fill="#101010">${esc(label)}</text>
    <text x="${txtX}" y="${y + stepLabelSize * 1.35}" font-family="${BODY}" font-size="${stepSubSize}" fill="#333">${esc(sub1)}</text>
    ${sub2 ? `<text x="${txtX}" y="${y + stepLabelSize * 1.35 + stepSubSize * 1.45}" font-family="${BODY}" font-size="${stepSubSize}" fill="#333">${esc(sub2)}</text>` : ""}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <text x="${cx}" y="${headY}" font-family="${TITLE}" font-size="${headSize}" fill="#101010" text-anchor="middle">A Gifting Card Game</text>
  <text x="${cx}" y="${introY}" font-family="${BODY}" font-size="${introSize}" fill="#1a1a1a" text-anchor="middle" font-style="italic">This card carries a sequence. Pass it on.</text>

  ${step(step1Y, "1", "Learn the sequence.",
    "Practice the flow until it lives in your",
    "hands — memorized, no card needed.")}

  ${step(step2Y, "2", "Teach it to a friend.",
    "Then gift or trade this card onward —",
    "every hand-off keeps the flow moving.")}

  <text x="${cx}" y="${closeY}" font-family="${BODY}" font-size="${closeSize}" fill="#1a1a1a" text-anchor="middle" font-style="italic">Learn it. Share it. Set it free.</text>
  <text x="${cx}" y="${signY}" font-family="${TITLE}" font-size="${Math.round(W * 0.06)}" fill="#6600cc" text-anchor="middle">The Kinetic Alphabet</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(`${DIR}/back.png`);
  console.log("back.png", W + "x" + H, "| signY%:", (signY / H * 100).toFixed(1));
})();
