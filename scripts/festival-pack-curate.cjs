// Builds the festival sampler proposals from a mix of published sequences and
// generated LOOPs. Every supported pack gets its own generated mirrored and
// compound cards so no slot is silently pinned across the print run.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
const TURN_PATTERN_FREEZER = path.join(
  REPO,
  "scripts/festival-pack-freeze-turn-patterns.ts"
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
const FESTIVAL_SLOT_ORDER = [
  "mirrored16",
  "mirrored8",
  "rotated16",
  "rotated8",
  "tndBase",
  "tndTurn",
  "mirroredSwapped8",
  "mirroredInverted8",
];
const TURN_SCHEDULE_SEED = 0x4f2c8b17;
const LEVEL_THREE_SCHEDULE_SEED = 0x68e31a4d;
const TURN_PATTERN_UNITS = {
  4: [
    "1|1-0|0-1|1-0|0",
    "1|0-0|1-1|0-0|1",
    "1|0-1|0-1|0-1|0",
    "0|1-0|1-0|1-0|1",
  ],
  8: [
    "1|0-0|1-0|0-0|0-1|0-0|1-0|0-0|0",
    "0|0-1|0-0|0-0|1-0|0-1|0-0|0-0|1",
    "1|0-0|1-1|0-0|1-1|0-0|1-1|0-0|1",
    "1|0-1|0-1|0-1|0-1|0-1|0-1|0-1|0",
  ],
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
    turnIntensity: 0,
    loopType: sequence.loopType,
    sequenceLength: sequence.sequenceLength,
    gridMode: sequence.gridMode,
    period: sequence.period ?? null,
    startPosition,
    endPosition: startPosition,
    sourceRef: sequence.sourceRef,
  };
}

function tndCard({ slot, record }) {
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
    catalogId: "l1-tnd-motions",
    docId: `${record.id}-1to1`,
    name,
    word: name,
    level: 1,
    sequenceLength: 4,
    familyId,
    vtgFamily: family,
    ratio: "1:1",
    turnIntensity: 0,
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
  const turns = (record?.steps ?? []).flatMap((step) => [
    step?.motions?.blue?.turns,
    step?.motions?.red?.turns,
  ]);
  const difficultyIsValid =
    record?.level === 1 &&
    record?.turnIntensity === 0 &&
    turns.every((turn) => turn === 0);
  if (
    !requirement ||
    !difficultyIsValid ||
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
          turnIntensity: record?.turnIntensity,
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
    level: 1,
    turnIntensity: 0,
    loopType: record.loopType,
    sequenceLength: record.steps.length,
    gridMode: record.gridMode,
    period: record.period ?? null,
    startPosition,
    endPosition,
  };
}

function buildGeneratedPairs(localRecords) {
  const records = Object.values(localRecords);
  const mirrored = records
    .filter((record) => record.loopType === "mirrored")
    .sort((a, b) => a.id.localeCompare(b.id));
  const mirroredSwapped = records
    .filter((record) => record.loopType === "mirrored_swapped")
    .sort((a, b) => a.id.localeCompare(b.id));
  const mirroredInverted = records
    .filter((record) => record.loopType === "mirrored_inverted")
    .sort((a, b) => a.id.localeCompare(b.id));
  if (
    mirrored.length !== 60 ||
    mirroredSwapped.length !== 60 ||
    mirroredInverted.length !== 60
  ) {
    throw new Error(
      `expected 60 generated cards in each local slot; found ${mirrored.length} mirrored, ${mirroredSwapped.length} mirrored+swapped, and ${mirroredInverted.length} mirrored+inverted`
    );
  }
  return mirrored.map((plain, index) => {
    const swapped = mirroredSwapped[index];
    const inverted = mirroredInverted[index];
    if (!plain || !swapped || !inverted) {
      throw new Error(
        `generated pack ${index + 1} is missing one of its three local LOOPs`
      );
    }
    return {
      mirrored16: plain.id,
      mirroredSwapped8: swapped.id,
      mirroredInverted8: inverted.id,
    };
  });
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBalancedTurnSchedule() {
  const combinations = [];
  for (let first = 0; first < FESTIVAL_SLOT_ORDER.length - 2; first++) {
    for (
      let second = first + 1;
      second < FESTIVAL_SLOT_ORDER.length - 1;
      second++
    ) {
      for (
        let third = second + 1;
        third < FESTIVAL_SLOT_ORDER.length;
        third++
      ) {
        combinations.push([
          FESTIVAL_SLOT_ORDER[first],
          FESTIVAL_SLOT_ORDER[second],
          FESTIVAL_SLOT_ORDER[third],
        ]);
      }
    }
  }

  // C(8, 3) is 56, so the 60-pack run contains every possible triple once.
  // Four balanced repeats raise each slot from 21 appearances to 22 or 23.
  const extras = [
    [FESTIVAL_SLOT_ORDER[0], FESTIVAL_SLOT_ORDER[1], FESTIVAL_SLOT_ORDER[2]],
    [FESTIVAL_SLOT_ORDER[3], FESTIVAL_SLOT_ORDER[4], FESTIVAL_SLOT_ORDER[5]],
    [FESTIVAL_SLOT_ORDER[6], FESTIVAL_SLOT_ORDER[7], FESTIVAL_SLOT_ORDER[0]],
    [FESTIVAL_SLOT_ORDER[1], FESTIVAL_SLOT_ORDER[3], FESTIVAL_SLOT_ORDER[6]],
  ];
  const schedule = [...combinations, ...extras];
  const random = createSeededRandom(TURN_SCHEDULE_SEED);
  for (let index = schedule.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [schedule[index], schedule[swapIndex]] = [
      schedule[swapIndex],
      schedule[index],
    ];
  }
  return schedule;
}

function buildBalancedLevelThreeSchedule(levelTwoSchedule) {
  const random = createSeededRandom(LEVEL_THREE_SCHEDULE_SEED);
  const counts = new Map(FESTIVAL_SLOT_ORDER.map((slot) => [slot, 0]));
  const schedule = levelTwoSchedule.map((levelTwoSlots) => {
    const eligible = FESTIVAL_SLOT_ORDER.filter(
      (slot) => !levelTwoSlots.includes(slot)
    );
    for (let index = eligible.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [eligible[index], eligible[swapIndex]] = [
        eligible[swapIndex],
        eligible[index],
      ];
    }
    const minimum = Math.min(...eligible.map((slot) => counts.get(slot)));
    const leastUsed = eligible.filter((slot) => counts.get(slot) === minimum);
    const selected = leastUsed[Math.floor(random() * leastUsed.length)];
    counts.set(selected, counts.get(selected) + 1);
    return selected;
  });

  const distribution = [...counts.values()].sort((a, b) => a - b);
  if (distribution.join(",") !== "7,7,7,7,8,8,8,8") {
    throw new Error(
      `festival Level 3 schedule is not balanced: ${distribution.join(",")}`
    );
  }
  return schedule;
}

function buildTurnPattern(card, level, packIndex) {
  const period = card.source === "catalog" ? 1 : Number(card.period ?? 1);
  const unitLength = Number(card.sequenceLength) / period;
  const patterns = TURN_PATTERN_UNITS[unitLength];
  if (!patterns) {
    throw new Error(
      `${card.slot} has no festival turn pattern for a ${unitLength}-step structural unit`
    );
  }
  const slotIndex = FESTIVAL_SLOT_ORDER.indexOf(card.slot);
  const wholePattern =
    patterns[(packIndex + slotIndex * 3 + level) % patterns.length];
  return level === 3 ? wholePattern.replaceAll("1", "0.5") : wholePattern;
}

function applyTurnAssignment(card, levelTwoSlots, levelThreeSlot, packIndex) {
  const isLevelTwo = levelTwoSlots.has(card.slot);
  const isLevelThree = card.slot === levelThreeSlot;
  if (isLevelTwo && isLevelThree) {
    throw new Error(`${card.slot} cannot be both Level 2 and Level 3`);
  }
  const level = isLevelTwo ? 2 : isLevelThree ? 3 : 1;
  const turnIntensity = isLevelTwo ? 1 : isLevelThree ? 0.5 : 0;
  const turnPattern =
    level === 1 ? undefined : buildTurnPattern(card, level, packIndex);
  const assigned = {
    ...card,
    level,
    turnIntensity,
    ...(turnPattern && { turnPattern }),
  };

  if (card.source === "catalog") {
    const ratio = isLevelTwo ? "3:1" : isLevelThree ? "2:1" : "1:1";
    return {
      ...assigned,
      ratio,
      catalogId: isLevelTwo
        ? "tnd-3to1-motions"
        : isLevelThree
          ? "tnd-2to1-motions"
          : "l1-tnd-motions",
      docId: `${card.docId.replace(/-(?:1to1|2to1|3to1)$/, "")}-${ratio.replace(":", "to")}`,
    };
  }
  return assigned;
}

function candidateKey(names) {
  return [
    names.mirrored16,
    names.mirrored8,
    names.rotated16,
    names.rotated8,
    names.tndBase,
    names.tndTurn,
    names.mirroredSwapped8,
    names.mirroredInverted8,
  ].join("|");
}

const FESTIVAL_COMPARISON_COUNT = 50;
const FESTIVAL_BATCH_COUNT = 60;
const FESTIVAL_COMPARISON_GENERATED_AT = "2026-08-12T17:26:16.217Z";

function buildCandidateNames(
  count = FESTIVAL_COMPARISON_COUNT,
  tndRecords = JSON.parse(fs.readFileSync(TND_BASE_WORDS, "utf8")),
  localRecords = JSON.parse(fs.readFileSync(LOCAL_SEQUENCE_SNAPSHOT, "utf8"))
    .records
) {
  const tndPairs = buildTndPairs(tndRecords);
  const generatedPairs = buildGeneratedPairs(localRecords);
  const selected = {
    mirrored8: "DJII",
    rotated16: "OVXΔ",
    rotated8: "MVNU",
    ...tndPairs[0],
    ...generatedPairs[0],
  };
  const candidates = [selected];
  const seen = new Set([candidateKey(selected)]);
  outer: for (const mirrored8 of MIRRORED_8) {
    for (const rotated16 of ROTATED_16) {
      for (const rotated8 of ROTATED_8) {
        const names = {
          mirrored8,
          rotated16,
          rotated8,
          ...tndPairs[candidates.length % tndPairs.length],
          ...generatedPairs[candidates.length % generatedPairs.length],
        };
        const key = candidateKey(names);
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(names);
        if (candidates.length === count) break outer;
      }
    }
  }
  return candidates;
}

function buildUniqueBatchNames(
  count = FESTIVAL_BATCH_COUNT,
  tndRecords = JSON.parse(fs.readFileSync(TND_BASE_WORDS, "utf8")),
  localRecords = JSON.parse(fs.readFileSync(LOCAL_SEQUENCE_SNAPSHOT, "utf8"))
    .records
) {
  const tndPairs = buildTndPairs(tndRecords);
  const generatedPairs = buildGeneratedPairs(localRecords);
  const selected = {
    mirrored8: "DJII",
    rotated16: "OVXΔ",
    rotated8: "MVNU",
    ...tndPairs[0],
    ...generatedPairs[0],
  };
  const combinations = [];
  // Mirrored-8 changes fastest, so an odd stride distributes both words
  // throughout the batch instead of exhausting one first.
  for (const rotated8 of ROTATED_8) {
    for (const rotated16 of ROTATED_16) {
      for (const mirrored8 of MIRRORED_8) {
        combinations.push({
          mirrored8,
          rotated16,
          rotated8,
        });
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
            ...generatedPairs[index],
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
    ? buildUniqueBatchNames(count, tndRecords, localRecords)
    : buildCandidateNames(count, tndRecords, localRecords);
  const turnSchedule = buildBalancedTurnSchedule();
  const levelThreeSchedule = buildBalancedLevelThreeSchedule(turnSchedule);
  if (candidateNames.length > turnSchedule.length) {
    throw new Error(
      `festival turn schedule supports ${turnSchedule.length} packs; received ${candidateNames.length}`
    );
  }
  const candidates = candidateNames.map((names, index) => {
    const turnedSlots = new Set(turnSchedule[index]);
    const levelThreeSlot = levelThreeSchedule[index];
    const cards = [
      localCard(localRecords[names.mirrored16], "mirrored16"),
      publishedCard(lookup(names.mirrored8), "mirrored8"),
      publishedCard(lookup(names.rotated16), "rotated16"),
      publishedCard(lookup(names.rotated8), "rotated8"),
      tndCard({
        slot: "tndBase",
        record: tndLookup.get(names.tndBase),
      }),
      tndCard({
        slot: "tndTurn",
        record: tndLookup.get(names.tndTurn),
      }),
      localCard(localRecords[names.mirroredSwapped8], "mirroredSwapped8"),
      localCard(localRecords[names.mirroredInverted8], "mirroredInverted8"),
    ];
    return {
      rank: index + 1,
      selected: index === 0,
      cards: cards.map((card) =>
        applyTurnAssignment(card, turnedSlots, levelThreeSlot, index)
      ),
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    constraint:
      "Exactly three of all eight choreography cards in every pack are Level 2 with sparse one-turn patterns. One of the remaining five is randomly assigned Level 3 with a sparse half-turn pattern; the other four stay Level 1 with zero turns. Every frozen turn pattern is selected through the canonical variation engine and must preserve loop closure. Across 60 packs, all 56 possible Level 2 triples appear, every slot receives Level 2 22 or 23 times, and every slot receives Level 3 7 or 8 times. Every card starts and ends in Alpha, Beta, or Gamma. Rotated 16-step cards are Quartered; rotated 8-step cards are Halved.",
    selectionReason:
      "Every supported pack has three Level 2 cards and one Level 3 card chosen from the full eight-card assortment, its own generated 16-step mirrored, mirrored+swapped, and mirrored+inverted cards, a distinct TnD pairing, and varied published LOOP cards.",
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
  const freezeResult = spawnSync(
    process.execPath,
    ["--import", "tsx", TURN_PATTERN_FREEZER],
    { cwd: REPO, encoding: "utf8" }
  );
  if (freezeResult.status !== 0) {
    throw new Error(
      `festival turn-pattern freeze failed:\n${freezeResult.stdout}${freezeResult.stderr}`
    );
  }
  process.stdout.write(freezeResult.stdout);
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
  buildBalancedTurnSchedule,
  buildBalancedLevelThreeSchedule,
  buildCandidateNames,
  buildGeneratedPairs,
  buildTndPairs,
  buildUniqueBatchNames,
  buildFestivalPackCuration,
  isClassicPosition,
};
