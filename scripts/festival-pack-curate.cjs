// Builds the 50 festival sampler proposals Austen requested from published,
// named Level-1 sequences. The comparison is intentionally honest: the scarce
// mirrored/compound slots remain mostly fixed, while the rotated slots carry
// the useful variation.
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const SNAPSHOT = path.join(REPO, "static/data/snapshots/public-sequences.json");
const EVIDENCE_DIR = path.join(
  REPO,
  "docs/superpowers/specs/festival-sample-pack/evidence"
);

const MIRRORED_8 = ["DJII", "EΦ-JΨ-DΦ-KΨ-"];
const ROTATED_16 = [
  "NROT",
  "ALFALGGF",
  "RRRS",
  "AKIΦ",
  "AJEΦ-",
  "AΔSX",
  "MΛWΔ",
  "Φ-BKE",
  "IIΩXKEΣY",
  "OVXΔ",
];
const ROTATED_8 = [
  "MVNU",
  "OT",
  "QT",
  "RT",
  "SN",
  "SOTR",
  "VPUQ",
  "JΦ",
  "DΨ",
  "ΦAΦ-L",
];
const MIRRORED_SWAPPED_8 = ["FALG", "GELIGELI"];

const FIXED = {
  mirrored16: "JIDCKIEC",
  vtgSplitSame: "AAAA",
  vtgTogetherSame: "GGGG",
  mirroredInverted8: "BΦ-AΦ-",
};

const SLOT_REQUIREMENTS = {
  mirrored16: { loopType: "mirrored", sequenceLength: 16 },
  mirrored8: { loopType: "mirrored", sequenceLength: 8 },
  rotated16: { loopType: "rotated", sequenceLength: 16 },
  rotated8: { loopType: "rotated", sequenceLength: 8 },
  mirroredSwapped8: { loopType: "mirrored_swapped", sequenceLength: 8 },
  mirroredInverted8: {
    loopType: "mirrored_inverted",
    sequenceLength: 8,
  },
};

function findPublishedSequence(documents, name) {
  const matches = documents.filter(
    (sequence) => sequence.name === name || sequence.id === name
  );
  if (matches.length !== 1) {
    throw new Error(
      `expected one published sequence named "${name}"; found ${matches.length}`
    );
  }
  return matches[0];
}

function assertSlot(sequence, slot) {
  const requirement = SLOT_REQUIREMENTS[slot];
  if (!requirement) throw new Error(`unknown sampler slot: ${slot}`);
  if (
    sequence.level !== 1 ||
    sequence.loopType !== requirement.loopType ||
    sequence.sequenceLength !== requirement.sequenceLength ||
    typeof sequence.sourceRef !== "string"
  ) {
    throw new Error(
      `${sequence.name} does not satisfy ${slot}: ` +
        JSON.stringify({
          level: sequence.level,
          loopType: sequence.loopType,
          sequenceLength: sequence.sequenceLength,
          sourceRef: sequence.sourceRef,
        })
    );
  }
}

function publishedCard(sequence, slot) {
  assertSlot(sequence, slot);
  return {
    slot,
    source: "publicSequences",
    id: sequence.id,
    name: sequence.name,
    word: sequence.word,
    level: sequence.level,
    loopType: sequence.loopType,
    sequenceLength: sequence.sequenceLength,
    gridMode: sequence.gridMode,
    period: sequence.period ?? null,
    startPosition: sequence.startPosition?.gridPosition ?? null,
    sourceRef: sequence.sourceRef,
  };
}

function tndCard({ slot, name, family, element, docId }) {
  return {
    slot,
    source: "catalog",
    catalogId: "tnd-3to1-motions",
    docId,
    name,
    word: name,
    level: 1,
    sequenceLength: 4,
    vtgFamily: family,
    element,
    ratio: "3:1",
    turnIntensity: 1,
  };
}

function candidateKey(names) {
  return [
    names.mirrored8,
    names.rotated16,
    names.rotated8,
    names.mirroredSwapped8,
  ].join("|");
}

function buildCandidateNames() {
  const selected = {
    mirrored8: "DJII",
    rotated16: "NROT",
    rotated8: "MVNU",
    mirroredSwapped8: "FALG",
  };
  const candidates = [selected];
  const seen = new Set([candidateKey(selected)]);

  // Walk the curated Cartesian product in a stable order. The published pool
  // is small enough that explicit enumeration is clearer than pseudo-random
  // sampling, and guarantees the requested count without duplicate packs.
  outer: for (const mirrored8 of MIRRORED_8) {
    for (const mirroredSwapped8 of MIRRORED_SWAPPED_8) {
      for (const rotated16 of ROTATED_16) {
        for (const rotated8 of ROTATED_8) {
          const names = {
            mirrored8,
            rotated16,
            rotated8,
            mirroredSwapped8,
          };
          const key = candidateKey(names);
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push(names);
          if (candidates.length === 50) break outer;
        }
      }
    }
  }
  return candidates;
}

function buildFestivalPackCuration(documents) {
  const lookup = (name) => findPublishedSequence(documents, name);
  const candidateNames = buildCandidateNames();
  const candidates = candidateNames.map((names, index) => ({
    rank: index + 1,
    selected: index === 0,
    cards: [
      publishedCard(lookup(FIXED.mirrored16), "mirrored16"),
      publishedCard(lookup(names.mirrored8), "mirrored8"),
      publishedCard(lookup(names.rotated16), "rotated16"),
      publishedCard(lookup(names.rotated8), "rotated8"),
      tndCard({
        slot: "vtgSplitSame",
        name: FIXED.vtgSplitSame,
        family: "Split-Same",
        element: "water",
        docId: "tnd-3to1-split-same-aaaa",
      }),
      tndCard({
        slot: "vtgTogetherSame",
        name: FIXED.vtgTogetherSame,
        family: "Together-Same",
        element: "earth",
        docId: "tnd-3to1-tog-same-gggg",
      }),
      publishedCard(lookup(names.mirroredSwapped8), "mirroredSwapped8"),
      publishedCard(lookup(FIXED.mirroredInverted8), "mirroredInverted8"),
    ],
  }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    constraint:
      "Type 1 and turn intensity <= 2 apply to the two VTG teaching cards; LOOP slots are published Level-1 sequences.",
    selectionReason:
      "Candidate 1 is Austen's approved control and uses the clearest published names in every scarce slot.",
    candidates,
    selected: candidates[0],
  };
}

function writeCuration() {
  const documents = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")).documents;
  const curation = buildFestivalPackCuration(documents);
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const candidatesPath = path.join(
    EVIDENCE_DIR,
    "festival-pack-50-candidates.json"
  );
  const selectedPath = path.join(EVIDENCE_DIR, "festival-pack-selected.json");
  fs.writeFileSync(candidatesPath, JSON.stringify(curation, null, 2) + "\n");
  fs.writeFileSync(
    selectedPath,
    JSON.stringify(curation.selected, null, 2) + "\n"
  );
  console.log(`wrote ${candidatesPath}`);
  console.log(`wrote ${selectedPath}`);
  console.log(`candidates: ${curation.candidates.length}`);
  console.log(
    `selected: ${curation.selected.cards.map((card) => card.name).join(", ")}`
  );
}

if (require.main === module) writeCuration();

module.exports = {
  buildCandidateNames,
  buildFestivalPackCuration,
};
