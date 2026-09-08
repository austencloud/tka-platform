# History archive

The `/history` page introduces the people, publications, and teaching projects
behind flow arts notation and movement vocabulary. Its ledger is a selection,
not an exhaustive history or a progression toward Austen Cloud's software.

## Editorial hierarchy

A selected entry leads with its full title, contributors, qualified date, and
account of the work. Sources remain visible in the reading flow. Small source
notes carry review status; unresolved authorship stays beside the account.

For The Kinetic Alphabet, keep these roles distinct:

- **The Kinetic Alphabet:** the notation. Its primary explanatory link is the guide.
- **Flow Arts Composer:** Austen Cloud's main application for composing,
  animating, saving, and sharing sequences.
- **Shape Engine:** an exploration tool within Composer, also usable on its
  own, bringing together VTG, TKA, timing, and direction. The public name is
  Shape Engine; Kinetic Shape Engine is a former name.

These product relationships and the naming decision were supplied by Austen
Cloud in the September 5, 2026 history review. Do not turn them into a claim
that any historical system culminated in Shape Engine.

Lorq Nichols' entry presents his complete original 144 Shape Matrix sheet and
links to his publication. Austen's extension is described in the separate
software context. Original authorship must survive both the label and the link.

## Interaction and composition

A chronological index supports a document reader. All entries have their own
visible index link; nearby dates are not bundled as a historical relationship.
At compact widths the index becomes a disclosure above the reader. The page
scrolls naturally. Previous and next links sit below the selected entry.

The index uses native links, preserves modified clicks, and maintains the
`#archive-record-<id>` URL contract. Selecting an entry moves focus to the reader.
Browser back and forward restore the selection.

Original illustrations, preserved documents, and demonstrations made for this
site are labeled as such. Text-only entries do not receive invented artwork.
At wide widths, the illustration sits alongside the account and sources. At
narrow widths it follows the introduction and precedes the detailed material.

The TKA preview uses the homepage's `createHeroAct` owner and its changing
sequences and props. Explicit preview settings isolate it from saved user
animation preferences. An example sequence is not a canonical work.

## Owners

- `archive-ledger.ts`: records, qualified dates, contributors, and claim-level sources.
- `notation-catalog.ts`: notation descriptions, classified explanatory links,
  and distinct present-day application relationships.
- `archive-presentation.ts`: original/demonstration/document labels, safe hash
  parsing, and structured metadata. Observation dates and PDF export dates must
  never be emitted as a work's creation date.
- `ArchiveEntryDetail.svelte`: reading order and visible attribution.
- `PlayableArchive.svelte`: selection, responsive index, and browser history.
- Existing artifact components own their interactive renderers and controls.

Keep the complete original documents and the sources that support each account.
An available correction link must have a working destination; the current
mailto opens a message the visitor can choose to send.
