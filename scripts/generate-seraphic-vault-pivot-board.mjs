#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const directory = path.resolve(root, "docs/superpowers/specs/seraphic-vault");
const studies = [
  ["01", "CLOUDBREAK · THE HIGH QUIET", "Expansive natural refuge", "seraphic-vault-pivot-study-01-cloudbreak.png"],
  ["02", "SUNLIT SKY GARDEN", "Delightful, living edges", "seraphic-vault-pivot-study-02-sky-garden.png"],
  ["03", "SOLAR OVERLOOK", "Curious, prismatic light", "seraphic-vault-pivot-study-03-solar-overlook.png"],
  ["04", "CLOUD LAGOON", "Restorative, spa-like calm", "seraphic-vault-pivot-study-04-cloud-lagoon.png"],
  ["05", "OLIVE CLOUDBREAK", "Peaceful life and shade", "seraphic-vault-pivot-study-05-olive-cloudbreak.png"],
  ["06", "OLIVE RUINS", "Classical memory and character", "seraphic-vault-pivot-study-06-olive-ruins.png"],
];

const cellWidth = 800;
const imageHeight = 450;
const positions = studies.map((_, index) => ({
  left: 40 + (index % 3) * 840,
  top: 130 + Math.floor(index / 3) * 555,
}));

const images = await Promise.all(studies.map(async ([, , , filename]) =>
  sharp(path.join(directory, filename))
    .resize(cellWidth, imageHeight, { fit: "cover" })
    .png()
    .toBuffer()
));

const labels = studies.map(([number, title, promise], index) => {
  const { left, top } = positions[index];
  return `
    <rect x="${left}" y="${top + imageHeight}" width="${cellWidth}" height="76" fill="#0d2944"/>
    <text x="${left + 20}" y="${top + imageHeight + 31}" fill="#f2c26b" font-family="Arial, sans-serif" font-size="20" font-weight="700">${number} · ${title}</text>
    <text x="${left + 20}" y="${top + imageHeight + 59}" fill="#b9cddd" font-family="Arial, sans-serif" font-size="16">${promise}</text>`;
}).join("");

const board = Buffer.from(`
<svg width="2560" height="1440" viewBox="0 0 2560 1440" xmlns="http://www.w3.org/2000/svg">
  <rect width="2560" height="1440" fill="#06182a"/>
  <text x="40" y="55" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="34" font-weight="700">CELESTIAL PIVOT STUDIES · FROM HEAVEN ICONOGRAPHY TO A PLACE PEOPLE WANT TO STAY</text>
  <text x="40" y="88" fill="#9db5cb" font-family="Arial, sans-serif" font-size="18">Same wide performance logic, clear center, natural sun, and cloud depth. Different emotional promises.</text>
  ${positions.map(({ left, top }) => `<rect x="${left - 2}" y="${top - 2}" width="${cellWidth + 4}" height="530" rx="5" fill="#0d2944" stroke="#527b9b" stroke-width="2"/>`).join("")}
  ${labels}
  <rect x="40" y="1240" width="2480" height="145" rx="9" fill="#0d2944" stroke="#315b7b" stroke-width="2"/>
  <text x="70" y="1282" fill="#77d4a5" font-family="Arial, sans-serif" font-size="19" font-weight="700">BROAD APPEAL LEAD: 05 · OLIVE CLOUDBREAK</text>
  <text x="70" y="1316" fill="#b9cddd" font-family="Arial, sans-serif" font-size="17">Trees add life, scale, shade, and peace without filling the performer lane. 06 has stronger narrative character but risks returning to a classical-afterlife cliché.</text>
  <text x="70" y="1350" fill="#7f9bb1" font-family="Arial, sans-serif" font-size="15">Exploratory concept studies only. No scene gate, runtime owner, or approved camera contract has been replaced.</text>
</svg>`);

await sharp(board)
  .composite(images.map((input, index) => ({ input, ...positions[index] })))
  .png({ compressionLevel: 9 })
  .toFile(path.join(directory, "seraphic-vault-pivot-study-board.png"));

console.log("docs/superpowers/specs/seraphic-vault/seraphic-vault-pivot-study-board.png");
