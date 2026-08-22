# Canonical Learning Experience

**Decision (2026-08-21, Austen):** Interactive Concepts is the canonical way
to learn The Kinetic Alphabet. The faithful Guide pages remain the canonical
written reference and the source for print/PDF publication.

This separates two jobs that were previously competing under the word
"Guide":

- `/learn/concepts` is the course. It teaches one layer at a time through
  direct interaction, guided practice, and assessment.
- `/guide` is the readable reference. It supports topic lookup, continuous
  reading, print-faithful pages, downloads, and search indexing.
- `/learn/play` is the standalone arcade. Lessons may launch configured
  practice slices from its games later, but they do not copy game engines.

Both learning modes remain mutually discoverable. A published lesson links to
its written topic, and a written topic links back when an interactive lesson
exists.

## Product truth

`concept-experience-registry.ts` owns the set of lessons that can actually be
opened. The 28-item curriculum in `concepts.ts` remains the planning sequence;
it is not an availability claim. Cards, deep links, progress totals, rendering,
and Guide cross-links must derive availability from the experience registry.

Every published lesson has a stable URL:

```text
/learn/concepts/<concept-id>
```

Unknown and unpublished concept IDs return to the course path rather than
opening a placeholder that looks released.

## Capability ownership evidence

Searches covered `concept`, `lesson`, `guide`, `route`, `active concept`,
`progress`, and `game`. The closest owners were:

- `concepts.ts`: curriculum order and prerequisite metadata;
- `ConceptDetailView.svelte`: experience rendering, previously a duplicated
  hard-coded availability list;
- `experience-persistence.svelte.ts`: lesson resume state;
- `url-state.ts`: browser URL/history writes;
- `game-registry.ts`: standalone arcade definitions.

This change extends those owners. It creates one feature-local availability
registry, composes the existing URL writer for concept deep links, and keeps
the readable Guide and arcade implementations separate.

## Superseded ambiguity

This decision refines, rather than discards, the earlier ADRs:

- `guide-single-source.md` still governs the Guide's written content and
  print/online parity.
- `concepts-convergence-notes.md` governs the instructional experience.

"Canonical Guide content" and "canonical way to learn" are no longer treated
as the same product role.

## Release rules

1. A lesson appears in the learning path only after its experience is entered
   in the registry.
2. `CONFIRMED` still requires Austen to use and approve the lesson. A built
   lesson may ship, but its internal review status remains explicit.
3. A Guide topic only advertises an interactive lesson when the registry maps
   that exact topic.
4. Future game reuse goes through a configured practice adapter owned by Learn;
   scoring and game mechanics remain owned by Play.

## Verification

- Registry IDs must exist in the curriculum and remain unique.
- Guide mappings must remain unique and point to real Level 1 slugs.
- Direct load, refresh, in-page Back, and browser Back/Forward must preserve the
  selected lesson and URL.
- Course and Guide entry points are checked at 375x667, 960x412, 820x1180,
  1440x900, 1920x1080, 2560x1440, and 3840x2160.
