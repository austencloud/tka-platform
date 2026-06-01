// Builds the donation card FRONT artwork as a high-res PNG.
// Layout fills the white inner area of a rainbow-bordered card (4.0 x 5.25 in
// card; inner ~264 x 354 pt). Title in calligraphic italic (Monotype Corsiva,
// matching the original tip-cards.pdf), serif body (Georgia). The two payment
// QRs + their wordmark logos (extracted verbatim from tip-cards.pdf) sit side
// by side below the message.
const sharp = require("sharp");
const fs = require("fs");

const DIR = "E:/tka-platform/static/donation";

// Inner white area in points; render at SCALE px/pt.
const IN_W_PT = 264, IN_H_PT = 354;
const SCALE = 12;                 // ~864 dpi at 72pt/in basis on the inner area
const W = Math.round(IN_W_PT * SCALE); // 3168
const H = Math.round(IN_H_PT * SCALE); // 4248

(async () => {
  // Load + measure the extracted assets so we can place them at correct aspect.
  const meta = async (p) => { const m = await sharp(p).metadata(); return { p, w: m.width, h: m.height }; };
  const qrPP = await meta(`${DIR}/qr-paypal.png`);
  const qrVN = await meta(`${DIR}/qr-venmo.png`);
  const logoPP = await meta(`${DIR}/logo-paypal.png`);
  const logoVN = await meta(`${DIR}/logo-venmo.png`);

  // --- Layout (all in px on the W x H canvas) ---
  const PADX = Math.round(W * 0.06);
  const contentW = W - 2 * PADX;
  const cx = W / 2;

  // Title (two lines, calligraphic)
  const titleSize = Math.round(W * 0.105);
  const titleY1 = Math.round(H * 0.085);
  const titleY2 = titleY1 + Math.round(titleSize * 1.02);

  // Suggested donation line
  const subSize = Math.round(W * 0.072);
  const subY = titleY2 + Math.round(titleSize * 0.92);

  // Body (3 lines) — serif, comfortably sized to fit
  const bodySize = Math.round(W * 0.0445);
  const bodyLeading = Math.round(bodySize * 1.5);
  const bodyY0 = subY + Math.round(subSize * 1.15);
  const body = [
    "I hope these supplies illuminate the path of",
    "your flow arts journey! Community donations",
    "are essential to empower its future. I am truly",
    "grateful for any amount of support!",
  ];
  // signature
  const sigSize = Math.round(W * 0.05);
  const sigY = bodyY0 + body.length * bodyLeading + Math.round(bodySize * 0.9);

  // --- QR + logo block, side by side ---
  const qrSide = Math.round(contentW * 0.46);     // each QR square side (int)
  const colGap = contentW - 2 * qrSide;           // gap between columns
  const leftColX = PADX;                           // left column x
  const rightColX = PADX + qrSide + colGap;        // right column x
  const qrTop = sigY + Math.round(sigSize * 0.7);

  // logo dimensions: fit within column width, keep aspect
  const logoMaxW = Math.round(qrSide * 0.92);
  const ppLogoW = logoMaxW, ppLogoH = Math.round(ppLogoW * logoPP.h / logoPP.w);
  const vnLogoW = logoMaxW, vnLogoH = Math.round(vnLogoW * logoVN.h / logoVN.w);
  const logoGap = Math.round(qrSide * 0.10);
  const logoTop = qrTop + qrSide + logoGap;
  const logoBandH = Math.max(ppLogoH, vnLogoH);

  // Resize the QR + logo bitmaps to their target boxes (crisp).
  const ppQrBuf = await sharp(qrPP.p).resize({ width: qrSide, height: qrSide, fit: "fill", kernel: "nearest" }).png().toBuffer();
  const vnQrBuf = await sharp(qrVN.p).resize({ width: qrSide, height: qrSide, fit: "fill", kernel: "nearest" }).png().toBuffer();
  const ppLogoBuf = await sharp(logoPP.p).resize({ width: ppLogoW }).png().toBuffer();
  const vnLogoBuf = await sharp(logoVN.p).resize({ width: vnLogoW }).png().toBuffer();

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const TITLE_FONT = "Monotype Corsiva";
  const BODY_FONT = "Georgia";

  const bodyLines = body.map((l, i) =>
    `<text x="${cx}" y="${bodyY0 + i * bodyLeading}" font-family="${BODY_FONT}" font-size="${bodySize}" fill="#1a1a1a" text-anchor="middle">${esc(l)}</text>`
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${cx}" y="${titleY1}" font-family="${TITLE_FONT}" font-size="${titleSize}" fill="#101010" text-anchor="middle">Support The Kinetic</text>
  <text x="${cx}" y="${titleY2}" font-family="${TITLE_FONT}" font-size="${titleSize}" fill="#101010" text-anchor="middle">Alphabet</text>
  <text x="${cx}" y="${subY}" font-family="${TITLE_FONT}" font-size="${subSize}" fill="#222" text-anchor="middle">$20 – $30 Suggested Donation</text>
  ${bodyLines}
  <text x="${cx}" y="${sigY}" font-family="${BODY_FONT}" font-size="${sigSize}" font-style="italic" fill="#1a1a1a" text-anchor="middle">— Austen Cloud</text>
</svg>`;

  const layers = [
    { input: Buffer.from(svg), top: 0, left: 0 },
    { input: ppQrBuf, top: qrTop, left: leftColX },
    { input: vnQrBuf, top: qrTop, left: rightColX },
    { input: ppLogoBuf, top: logoTop + Math.round((logoBandH - ppLogoH) / 2), left: leftColX + Math.round((qrSide - ppLogoW) / 2) },
    { input: vnLogoBuf, top: logoTop + Math.round((logoBandH - vnLogoH) / 2), left: rightColX + Math.round((qrSide - vnLogoW) / 2) },
  ];

  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite(layers).png().toFile(`${DIR}/front.png`);

  console.log("front.png", W + "x" + H);
  console.log("bottom of logo band:", logoTop + logoBandH, "of", H, "->", ((logoTop + logoBandH) / H * 100).toFixed(1) + "% (must be < 100)");
})();
