# Film Director Directive Language (Schema v2) — Design

Date: 2026-08-23
Status: approved-for-planning
Governing parent: `2026-08-21-3d-film-director-instrumentation-design.md`
Builds on: the shipped `/test/film-director` instrument (schema v1, resolver,
camera tracks, warm-up plan, one-owner transitions), approved by Austen
2026-08-23 ("The shots are good").

## Goal

Austen dictates a film in ordinary language; Claude translates it into a
versioned document; the machine — not the translating agent — enforces the
intent. Success criterion, in his words: *"There should be no parameter that I
cannot speak to you and then have be a part of the system."*

Schema v1 is fully concrete: every performer field is a literal. Directives
like "every performer a different prop, I don't care which" or "performer 3
gets LED no matter what and nobody else may have it" cannot be written down —
the agent would resolve them privately and the intent would be lost from the
document. v2 makes constraint intent a first-class, machine-validated part of
the film document.

## Decisions (made with Austen, 2026-08-23)

| Decision | Choice |
|---|---|
| Architecture | **B — schema-level directive layer.** Claude translates language to directives; the resolver compiles directives to concrete picks. Rejected A (agent resolves privately, intent lost) and C (in-app NL parser — hand-rolls the agent already in the loop; contradicts the 2026-08-22 recorded decision). |
| Open picks on replay | **Locked until reroll.** Seeded deterministic resolution; same document = same film forever. Rerolls are explicit seed bumps, scoped per axis. |
| Camera depth | **Full cinematography vocabulary now** — named moves + framing grammar compiled to keyframes, not just presets. |
| Movement | **None in this pass.** Static formations per shot. Formation-over-time belongs to the stage-performance-runtime lane (`active/2026-08-20-stage-performance-runtime-design.md`). v2 leaves room for a future `choreography` field without a version break, but defines nothing for it. |
| Missing assets | Unchanged from parent spec: reject with a precise reason or enter the asset pipeline. Never fake. |

## 1. Directive expressions

Every axis that today takes a literal accepts `Directive<T>`:

```ts
type Directive<T> =
  | T                                   // literal, exactly as v1
  | { pick: "any"; from?: T[] }         // resolver picks; optional pool
  | { pick: "distinct"; from?: T[] }    // pairwise different across the cast
  | { oneOf: T[] }                      // sugar for { pick: "any", from }
  | { not: T | T[]; from?: T[] }        // anything but; optional pool
  | { sameAs: string }                  // copy another performer's resolved value
```

Directive-capable axes (per performer): `avatarId`, `prop`, `effect`,
`effort`, `staffLengthCm` (pool form only), plus per-shot `environmentId` and
`formation` (`pick: "any"` / `oneOf` / `not` forms; `distinct` and `sameAs`
are performer-scoped and rejected at shot scope). `effectPresets` values
accept `pick: "any"` scoped to that effect's registered preset group.

Semantics:

- **`distinct`** applies across the set of performers that inherit or state
  the directive on that axis. Performers with pinned literals count as taken
  values — distinct routes around them. Pool too small → rejection.
- **`not`** excludes; the candidate pool is `from` (if given) else the full
  catalog minus exclusions. Excluding everything → rejection.
- **`sameAs`** resolves after the referenced performer; reference to a
  missing id or a dependency cycle → rejection naming the chain.
- Unknown values anywhere (a prop not in `PropType`, an avatar not in
  `AVATAR_DEFINITIONS`, an effect not in the registry, a preset not in that
  effect's group) → rejection naming the value and the catalog checked.

## 2. Cast block

`performance.cast` replaces the bare performer array (which remains valid as
shorthand):

```jsonc
"performance": {
  "cast": {
    "count": 8,                                  // 1..8
    "defaults": {                                 // Directive-capable fields
      "prop":   { "pick": "distinct" },
      "effect": "fire"
    },
    "performers": [                               // sparse overrides by id/index
      { "id": "performer-3", "effect": "led" }
    ]
  }
}
```

Precedence per field: performer literal > performer directive > cast default >
system default (v1's defaults, unchanged). `count` with sparse `performers`
means "eight performers, all different props" never requires eight empty
objects. Formation valid-count checks (`PRESET_VALID_COUNTS`) apply to
`count`. Writing both a v1 `performers` array and a `cast` block is a
rejection, not a merge.

The exclusion pattern for Austen's canonical example — "everyone fire except
performer 3, who gets LED no matter what; nobody else may have LED" — is
`defaults.effect: "fire"` + override `{ id: "performer-3", effect: "led" }`;
the standalone form "anything but LED" is `{ "not": "led" }`.

## 3. Seeded deterministic resolution

Film-level `seed`:

```jsonc
"seed": { "base": 7, "axes": { "prop": 2 } }   // axes optional; base defaults
                                                // to a stable hash of film id
```

The resolver derives an independent deterministic stream per
(shot id, axis) from `base` + the axis salt, via a small pure PRNG
(no `Math.random`). Consequences:

- Same document = same film, on every machine, forever.
- "Shuffle the props" = bump `axes.prop`; avatars, effects, and every other
  already-liked pick do not move.
- Fixture tests can assert exact resolved output.

Resolution order per shot, per axis: validate literals → resolve `sameAs`
(topologically) → satisfy `distinct`/`not`/pool constraints by seeded
selection over the shuffled candidate pool → reject if unsatisfiable.

Rejection messages are written to be read back to Austen verbatim, e.g.
`Shot "finale" asks for distinct props across 8 performers but the allowed
pool has 5 (fire_double_staff, torch, bigtorch, staff, capsule_baton).`

## 4. Camera cinematography compiler

Declarative framing plus a chained move list, compiled onto the existing
keyframe machinery (`director-camera-track.ts`); raw keyframes remain the
escape hatch and the four v1 presets become sugar over this grammar.

```jsonc
"camera": {
  "subject":  { "kind": "performer", "performerId": "performer-3" }, // or group/point
  "shotSize": "close-up",        // close-up | medium | wide | extreme-wide
  "angle":    "low",             // low | eye | high | top
  "position": "front",           // front | left | right | behind | { "degrees": n }
  "moves": [
    { "move": "hold",    "durationSeconds": 2 },
    { "move": "push-in", "amount": { "meters": 3 }, "easing": "ease-in-out" },
    { "move": "orbit",   "direction": "ccw", "amount": { "degrees": 90 } }
  ]
}
```

- Framing (`subject` + `shotSize` + `angle` + `position`) computes the base
  camera position from the subject's bounding sphere and the film's aspect
  ratio, reusing the existing aspect-aware framing math.
- Moves: `push-in`, `pull-back`, `orbit` (cw/ccw, degrees), `crane`
  (up/down, meters), `pan` (left/right, degrees), `hold`. Moves chain
  sequentially; omitted durations split the remaining shot time evenly.
  Each move emits keyframes with the shot's easing vocabulary.
- Contradictions reject (`shotSize` given twice via preset + explicit,
  orbit with a vertical direction, moves exceeding shot duration).

## 5. Coverage inventory — derived, not remembered

First implementation step: sweep the film route's viewer adapter
(`director-viewer-adapter.ts`), `Viewer3DScene`/`Viewer3DCanvas` props, and
the `@austencloud/scene-3d` performer API to enumerate **every** controllable
input the deployed 3D system accepts (open question flagged for the sweep:
whether per-performer prop color is a live axis). The v2 schema must cover
the union; any real-but-unspeakable input is a defect of this project, and
any spoken-but-unreal parameter must reject.

Output: **capability truth matrix** at
`docs/reference/film-director-capability-matrix.md` — one row per axis:
grammar accepted, legal-value source-of-truth file (registry/enum/catalog
path, not a copied list that can rot), directive support, rejection behavior.
The matrix is also the dictation phrasebook for future sessions.

Catalog ground truth at design time: 40 prop types
(`prop-type.ts`), 16 avatars (`avatar-definitions`), 16 effects + none
(`effect-registry.ts`), 8 efforts, 12 formation presets with
`PRESET_VALID_COUNTS`, 10 environment ids (`scene-environment.ts`; the film
route currently retains/warms 4 — autumn, forest, ocean, celestial — the
warm-up plan derives from the film document, so additional environments are a
warm-up/retention question, not a schema question).

## 6. Adversarial corpus

`tests/unit/film-director/directive-corpus/` — fixture entries of
`{ utterance, json, expect }` where `expect` is `"resolves"` (optionally with
asserted picks) or `{ rejects: <message substring> }`. A runner test feeds
every fixture through the resolver. Target: a few hundred entries generated
adversarially, curated, across at least these categories:

1. Valid distribution combos (distinct, pools, sameAs chains, mixed pins).
2. Pinned + exclusion interactions (the LED example and mutations of it).
3. Unsatisfiable demands (distinct 8 from pool of 5; `not` everything;
   sameAs cycles; back-to-back with 3 performers; 9 performers).
4. Nonexistent assets (dragon avatar, chainsaw prop, unknown environment,
   a Goo preset applied to Fire, unknown scene feature).
5. Camera language (every move, chains, contradictions, over-duration).
6. Boundary values (bpm 19/301, duration 0.5/61, fov 19/101, staff 39/301).
7. Unknown axes (prop color if the sweep proves it absent, lighting, avatar
   scale) — proven to reject via `.strict()`, documented in the matrix.

The utterance half doubles as permanent calibration data: real phrasings a
human would say, paired with their canonical translation.

## 7. Versioning and migration

`version: 2`. The parser accepts v1 documents and maps them losslessly into
v2 (v1 is semantically a subset: all-literal, array-form cast). The sample
film `sky-is-the-limit.ts` migrates to v2 as the reference document. All 24
existing film-director/transition tests and the 3 performer tests stay green.

## 8. Testing

- Resolver: determinism (same seed → identical output; bumping one axis salt
  changes only that axis), precedence, distinct-around-pins, sameAs
  topology, every rejection path.
- Camera compiler: framing math per shot size/angle/position against known
  subjects; move chains produce monotonic, duration-bounded keyframes.
- Corpus runner over all fixtures.
- Matrix lockstep test: the axes enumerated in the capability matrix match
  the schema's directive-capable axes (doc can't silently rot).

## Out of scope

- Movement, locomotion, formation timelines (stage-performance-runtime lane).
- Arbitrary library/generated sequences (`sequence.source` stays `"demo"`;
  parent handoff loose end #5).
- In-app natural-language input.
- Offline render/encode path (parent loose end #3).
- New 3D assets of any kind.
