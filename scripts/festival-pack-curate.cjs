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
const TND_BASE_WORDS = path.join(REPO, "static/data/hero/tnd-base-words.json");
const LOCAL_SEQUENCE_SNAPSHOT = path.join(
  EVIDENCE_DIR,
  "festival-pack-local-sequences.json"
);
const RUNTIME_MANIFEST = path.join(
  REPO,
  "src/lib/features/choreo-card/data/festival-sampler-manifests.json"
);

const MIRRORED_8 = ["DJII", "EΦ-JΨ-DΦ-KΨ-"];
const ROTATED_16 = [
  "OVXΔ",
  "MΛWΔ",
  "AKIΦ",
  "AJEΦ-",
  "AΔSX",
  "AΣSW",
  "BΔTX",
  "BΣTW",
  "CΔUW",
  "CΣVX",
  "EJΦK",
  "FΦ-BJ",
  "IΩPY-",
  "KDCΦ-",
  "KΣ-XC",
];
const ROTATED_8 = [
  "MVNU",
  "OT",
  "QT",
  "RT",
  "SOTR",
  "VPUQ",
  "BΔMX",
  "BΣTX",
  "CΩ-SW-",
  "EΔUZ",
  "W-Θ-",
  "XΣΛS",
  "ΦAΦ-L",
];
const MIRRORED_SWAPPED_8 = ["FALG"];

const FIXED = {
  mirrored16: "JIDCKIEC",
  mirroredInverted8: "BΦ-AΦ-",
};

const SAME_DIRECTION_FAMILIES = new Set([
  "split-same",
  "tog-same",
  "quarter-same",
]);
const OPPOSITE_DIRECTION_FAMILIES = new Set([
  "split-opp",
  "tog-opp",
  "quarter-opp",
]);

const SLOT_REQUIREMENTS = {
  mirrored16: { loopType: "mirrored", sequenceLength: 16 },
  mirrored8: { loopType: "mirrored", sequenceLength: 8 },
  rotated16: { loopType: "rotated", sequenceLength: 16, period: 4 },
  rotated8: { loopType: "rotated", sequenceLength: 8, period: 2 },
  mirroredSwapped8: { loopType: "mirrored_swapped", sequenceLength: 8 },
  mirroredInverted8: {
    loopType: "mirrored_inverted",
    sequenceLength: 8,
  },
};

function isClassicPosition(position) {
  return new Set(["alpha1", "beta5", "gamma11"]).has(position ?? "");
}

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
  const startPosition = sequence.startPosition?.gridPosition;
  if (!requirement) throw new Error(`unknown sampler slot: ${slot}`);
  if (
    sequence.level !== 1 ||
    sequence.loopType !== requirement.loopType ||
    sequence.sequenceLength !== requirement.sequenceLength ||
    (requirement.period != null &&
      Number(sequence.period) !== requirement.period) ||
    sequence.isCircular !== true ||
    !isClassicPosition(startPosition) ||
    typeof sequence.sourceRef !== "string"
  ) {
    throw new Error(
      `${sequence.name} does not satisfy ${slot}: ` +
        JSON.stringify({
          level: sequence.level,
          loopType: sequence.loopType,
          sequenceLength: sequence.sequenceLength,
          period: sequence.period ?? null,
          isCircular: sequence.isCircular,
          startPosition,
          sourceRef: sequence.sourceRef,
        })
    );
  }
}

function publishedCard(sequence, slot) {
  assertSlot(sequence, slot);
  const startPosition = sequence.startPosition.gridPosition;
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
    startPosition,
    endPosition: startPosition,
    sourceRef: sequence.sourceRef,
  };
}

function tndCard({ slot, record, ratio, turnIntensity, level }) {
  const name = record?.name;
  const familyId = record?.metadata?.familyId;
  const family = record?.metadata?.familyLabel;
  const startPosition =
    record?.startPosition?.gridPosition ?? record?.steps?.[0]?.startPosition;
  const endPosition = record?.steps?.at(-1)?.endPosition;
  if (
    typeof name !== "string" ||
    typeof familyId !== "string" ||
    typeof family !== "string" ||
    record?.isCircular !== true ||
    !isClassicPosition(startPosition) ||
    !isClassicPosition(endPosition)
  ) {
    throw new Error(
      `${name} must start and end in Alpha, Beta, or Gamma: ` +
        JSON.stringify({ startPosition, endPosition })
    );
  }
  return {
    slot,
    source: "catalog",
    catalogId: turnIntensity === 0 ? "l1-tnd-motions" : "tnd-3to1-motions",
    docId: `${record.id}-${ratio.replace(":", "to")}`,
    name,
    word: name,
    level,
    sequenceLength: 4,
    familyId,
    vtgFamily: family,
    ratio,
    turnIntensity,
    startPosition,
    endPosition,
  };
}

function buildTndPools(records) {
  const classic = records.filter((record) => {
    const startPosition =
      record?.startPosition?.gridPosition ?? record?.steps?.[0]?.startPosition;
    const endPosition = record?.steps?.at(-1)?.endPosition;
    return (
      record?.isCircular === true &&
      isClassicPosition(startPosition) &&
      isClassicPosition(endPosition)
    );
  });
  const same = classic
    .filter((record) => SAME_DIRECTION_FAMILIES.has(record.metadata?.familyId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const opposite = classic
    .filter((record) =>
      OPPOSITE_DIRECTION_FAMILIES.has(record.metadata?.familyId)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (same.length !== 10 || opposite.length !== 9) {
    throw new Error(
      `expected 10 same-direction and 9 opposite-direction classic TnD words; found ${same.length} and ${opposite.length}`
    );
  }
  return { same, opposite };
}

function buildTndPairs(records) {
  const { same, opposite } = buildTndPools(records);
  const prioritizedOpposite = [
    opposite.find((record) => record.name === "JDJD"),
    ...opposite.filter((record) => record.name !== "JDJD"),
  ];
  const pairs = [];
  // Diagonal traversal exposes all 10 base words and all 9 turned words in
  // the first ten packs, then visits every one of the 90 pairings once.
  for (let round = 0; round < prioritizedOpposite.length; round++) {
    for (let baseIndex = 0; baseIndex < same.length; baseIndex++) {
      const turnIndex = (baseIndex + round) % prioritizedOpposite.length;
      pairs.push({
        tndBase: same[baseIndex].name,
        tndTurn: prioritizedOpposite[turnIndex].name,
      });
    }
  }
  return pairs;
}

function localCard(record, slot) {
  const startPosition = record?.startPosition?.gridPosition;
  const endPosition = record?.steps?.at(-1)?.endPosition;
  const requirement = SLOT_REQUIREMENTS[slot];
  if (
    !requirement ||
    record?.level !== 1 ||
    record?.loopType !== requirement.loopType ||
    record?.steps?.length !== requirement.sequenceLength ||
    record?.isCircular !== true ||
    !isClassicPosition(startPosition) ||
    !isClassicPosition(endPosition)
  ) {
    throw new Error(
      `${record?.name ?? "local sequence"} does not satisfy ${slot}: ` +
        JSON.stringify({
          level: record?.level,
          loopType: record?.loopType,
          sequenceLength: record?.steps?.length,
          isCircular: record?.isCircular,
          startPosition,
          endPosition,
        })
    );
  }
  return {
    slot,
    source: "packLocal",
    id: record.id,
    name: record.name,
    word: record.word,
    level: record.level,
    loopType: record.loopType,
    sequenceLength: record.steps.length,
    gridMode: record.gridMode,
    period: record.period ?? null,
    startPosition,
    endPosition,
  };
}

function candidateKey(names) {
  return [
    names.mirrored8,
    names.rotated16,
    names.rotated8,
    names.tndBase,
    names.tndTurn,
    names.mirroredSwapped8,
  ].join("|");
}

const FESTIVAL_COMPARISON_COUNT = 50;
const FESTIVAL_BATCH_COUNT = 200;
const FESTIVAL_COMPARISON_GENERATED_AT = "2026-08-12T17:26:16.217Z";

function buildCandidateNames(
  count = FESTIVAL_COMPARISON_COUNT,
  tndRecords = JSON.parse(fs.readFileSync(TND_BASE_WORDS, "utf8"))
) {
  const tndPairs = buildTndPairs(tndRecords);
  const selected = {
    mirrored8: "DJII",
    rotated16: "OVXΔ",
    rotated8: "MVNU",
    ...tndPairs[0],
    mirroredSwapped8: "FALG",
  };
  const candidates = [selected];
  const seen = new Set([candidateKey(selected)]);
  outer: for (const mirrored8 of MIRRORED_8) {
    for (const mirroredSwapped8 of MIRRORED_SWAPPED_8) {
      for (const rotated16 of ROTATED_16) {
        for (const rotated8 of ROTATED_8) {
          const names = {
            mirrored8,
            rotated16,
            rotated8,
            ...tndPairs[candidates.length % tndPairs.length],
            mirroredSwapped8,
          };
          const key = candidateKey(names);
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push(names);
          if (candidates.length === count) break outer;
        }
      }
    }
  }
  return candidates;
}

function buildUniqueBatchNames(
  count = FESTIVAL_BATCH_COUNT,
  tndRecords = JSON.parse(fs.readFileSync(TND_BASE_WORDS, "utf8"))
) {
  const tndPairs = buildTndPairs(tndRecords);
  const selected = {
    mirrored8: "DJII",
    rotated16: "OVXΔ",
    rotated8: "MVNU",
    ...tndPairs[0],
    mirroredSwapped8: "FALG",
  };
  const combinations = [];
  // Mirrored-8 changes fastest, so an odd stride distributes both words
  // throughout the batch instead of exhausting one first.
  for (const rotated8 of ROTATED_8) {
    for (const rotated16 of ROTATED_16) {
      for (const mirroredSwapped8 of MIRRORED_SWAPPED_8) {
        for (const mirrored8 of MIRRORED_8) {
          combinations.push({
            mirrored8,
            rotated16,
            rotated8,
            mirroredSwapped8,
          });
        }
      }
    }
  }

  if (count > combinations.length) {
    throw new Error(
      `requested ${count} festival packs, but the curated pool holds ${combinations.length}`
    );
  }

  // 37 is coprime with the 390-card Cartesian capacity. Walking the ring by
  // that stride visits every assortment exactly once while spreading both
  // rotated slots across the early packs Austen will print tonight.
  const candidates = [];
  const seen = new Set();
  for (let index = 0; candidates.length < count; index++) {
    const names =
      index === 0
        ? selected
        : {
            ...combinations[(index * 37) % combinations.length],
            ...tndPairs[index % tndPairs.length],
          };
    const key = candidateKey(names);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(names);
  }
  return candidates;
}

function buildFestivalPackCuration(
  documents,
  tndRecords = JSON.parse(fs.readFileSync(TND_BASE_WORDS, "utf8")),
  localRecords = JSON.parse(fs.readFileSync(LOCAL_SEQUENCE_SNAPSHOT, "utf8"))
    .records,
  count = FESTIVAL_COMPARISON_COUNT,
  spreadForPrinting = false
) {
  const lookup = (name) => findPublishedSequence(documents, name);
  const tndLookup = new Map(tndRecords.map((record) => [record.name, record]));
  const candidateNames = spreadForPrinting
    ? buildUniqueBatchNames(count, tndRecords)
    : buildCandidateNames(count, tndRecords);
  const candidates = candidateNames.map((names, index) => ({
    rank: index + 1,
    selected: index === 0,
    cards: [
      publishedCard(lookup(FIXED.mirrored16), "mirrored16"),
      publishedCard(lookup(names.mirrored8), "mirrored8"),
      publishedCard(lookup(names.rotated16), "rotated16"),
      publishedCard(lookup(names.rotated8), "rotated8"),
      tndCard({
        slot: "tndBase",
        record: tndLookup.get(names.tndBase),
        ratio: "1:1",
        turnIntensity: 0,
        level: 1,
      }),
      tndCard({
        slot: "tndTurn",
        record: tndLookup.get(names.tndTurn),
        ratio: "3:1",
        turnIntensity: 1,
        level: 2,
      }),
      localCard(localRecords[names.mirroredSwapped8], "mirroredSwapped8"),
      publishedCard(lookup(FIXED.mirroredInverted8), "mirroredInverted8"),
    ],
  }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    constraint:
      "Type 1 and turn intensity <= 2 apply to the two VTG teaching cards; LOOP slots are published Level-1 sequences. Every card starts and ends in Alpha, Beta, or Gamma. Rotated 16-step cards are Quartered; rotated 8-step cards are Halved.",
    selectionReason:
      "Candidate 1 keeps Austen's approved LOOP control and pairs a no-turn same-direction TnD card with a one-turn opposite-direction TnD card. The print batch rotates through 90 distinct TnD pairs before repeating a pair.",
    candidates,
    selected: candidates[0],
  };
}

function writeCuration() {
  const documents = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")).documents;
  const curation = buildFestivalPackCuration(
    documents,
    undefined,
    undefined,
    FESTIVAL_COMPARISON_COUNT
  );
  const batch = buildFestivalPackCuration(
    documents,
    undefined,
    undefined,
    FESTIVAL_BATCH_COUNT,
    true
  );
  curation.generatedAt = FESTIVAL_COMPARISON_GENERATED_AT;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const candidatesPath = path.join(
    EVIDENCE_DIR,
    "festival-pack-50-candidates.json"
  );
  const selectedPath = path.join(EVIDENCE_DIR, "festival-pack-selected.json");
  const batchPath = path.join(
    EVIDENCE_DIR,
    "festival-pack-unique-manifests.json"
  );
  fs.writeFileSync(candidatesPath, JSON.stringify(curation, null, 2) + "\n");
  fs.writeFileSync(
    selectedPath,
    JSON.stringify(curation.selected, null, 2) + "\n"
  );
  fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2) + "\n");
  fs.mkdirSync(path.dirname(RUNTIME_MANIFEST), { recursive: true });
  fs.writeFileSync(RUNTIME_MANIFEST, JSON.stringify(batch, null, 2) + "\n");
  console.log(`wrote ${candidatesPath}`);
  console.log(`wrote ${selectedPath}`);
  console.log(`wrote ${batchPath}`);
  console.log(`wrote ${RUNTIME_MANIFEST}`);
  console.log(`candidates: ${curation.candidates.length}`);
  console.log(
    `selected: ${curation.selected.cards.map((card) => card.name).join(", ")}`
  );
  console.log(`unique batch manifests: ${batch.candidates.length}`);
}

if (require.main === module) writeCuration();

module.exports = {
  buildCandidateNames,
  buildTndPairs,
  buildUniqueBatchNames,
  buildFestivalPackCuration,
  isClassicPosition,
};
