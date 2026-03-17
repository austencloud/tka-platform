# VTG Domain & Flow Arts Knowledge Architecture

**Date:** 2026-03-16
**Status:** Approved (verbal)
**Author:** Claude + Austen

---

## Problem

TKA's AI assistant (Tika) handles adversarial VTG questions poorly because the domain knowledge is thin — a 6-entry mapping table and scattered glossary entries. When challenged by VTG practitioners, Tika makes factual errors (e.g., claiming VTG has no name for quarter-time patterns, when quarter-same and quarter-opp exist as community extensions). The flow arts wiki (181 articles, 615 transcripts) sits unused by the AI layer.

## Solution

Build a family of flow arts domain packages with VTG as the first new domain, a shared type layer, and integration into both Tika and the MCP server.

---

## Architecture

### Package Structure

```
packages/
  flow-arts-core/              @flow-arts/core — shared types
  vtg-domain/                  @vtg/domain — VTG knowledge base
  domain/                      @tka/domain — existing, gains core dependency
```

### `@flow-arts/core`

Shared TypeScript types used by all domain packages. No runtime logic, just contracts.

**Types:**

```typescript
// Sourced claims — every fact has provenance
interface SourcedClaim {
  claim: string;
  sourceType: "document" | "community" | "tka-interpretation";
  sourceRef?: string;  // "VTG V1 p.4", URL, or person name
}

// Glossary entries with source tracking
interface FlowArtsGlossaryEntry {
  term: string;
  definition: string;
  source: SourcedClaim;
  aliases?: string[];
  relatedTerms?: string[];
  category: string;
  framework: string;  // "vtg", "tka", "caps", "general"
}

// Contributors / people
interface Contributor {
  name: string;
  aliases?: string[];        // "@noeltech", "Sir Lorq"
  role: string;              // "VTG co-creator", "Shape Matrix creator"
  contributions: string[];
  activeYears?: string;      // "2007-present"
  links?: ExternalReference[];
}

// External references
interface ExternalReference {
  url: string;
  title: string;
  type: "document" | "video" | "website" | "app" | "forum-post";
  author?: string;
  year?: number;
  accessDate?: string;
}

// Movement patterns (generic across systems)
interface MovementPattern {
  name: string;
  framework: string;
  description: string;
  source: SourcedClaim;
}

// Notation framework metadata
interface NotationFramework {
  id: string;               // "vtg", "tka", "caps", "9square", "qft"
  name: string;
  creators: string[];
  yearCreated: number;
  status: "active" | "historical" | "active-development";
  description: string;
  outputFormat: string;     // "categories", "letters/words", "formulas"
  primaryProp: string;      // "poi", "staves", "all"
}
```

### `@vtg/domain`

Full VTG knowledge base. Mirrors `@tka/domain` structure.

**Data modules:**

| File | Content | Primary Source |
|------|---------|---------------|
| `categories.ts` | SS, TS, SO, TO (original) + QS, QO (community) | VTG V1 p.5, community |
| `shapes.ts` | 10 minimal beat shapes + all pair combinations | VTG V1 p.4 |
| `patterns.ts` | 40 base patterns (10 shapes × 4 categories) | VTG V1 p.3-4, noelyee.com |
| `transitions.ts` | Transition theory matrices (all category→category paths) | VTG V1 p.5-7 |
| `orientations.ts` | Diamond/box, vertical/horizontal, how they interact | VTG V2 index volumes |
| `hybrids.ts` | 3D shapes, 144 patterns, VTG2 hands-vs-poi splits | VTG V1 p.12, VTG V2 |
| `driving-styles.ts` | Insignia's 8 driving styles | Community/wiki |
| `elemental-model.ts` | Earth/Water/Air/Fire/Sun/Moon mappings | Leonardo Icaza, Austen Cloud |
| `contributors.ts` | Noel Yee, David Cantor, Brian Thompson, etc. | Research doc, wiki |
| `glossary.ts` | VTG-specific terms with sourced definitions | Multiple sources |
| `documents.ts` | VTG V1, V2, Book of P.H.A.T. metadata | PDFs |
| `external-links.ts` | URLs, videos, wiki pages | Research sources doc |

**Reference functions (public API):**

```typescript
// Pattern lookup
getVTGPattern(shape: string, timing: string, direction: string): VTGPattern
getVTGPatterns(category: string): VTGPattern[]

// Transition theory
getVTGTransition(from: string, to: string): TransitionPath

// Shapes
getVTGShape(name: string): MinimalBeatShape
listVTGShapes(): MinimalBeatShape[]

// Categories
getVTGCategory(id: string): VTGCategory
listVTGCategories(): VTGCategory[]

// Cross-domain
vtgToTKA(category: string): TKAMapping
tkaToVTG(letter: string): VTGMapping

// People
getContributor(name: string): Contributor

// Search
searchVTG(query: string): SearchResult[]
```

### Wiki Harvesting

A build script reads `F:\flow-arts-wiki\content\drafts\*.wiki`, parses MediaWiki markup, and extracts structured data:

```
scripts/harvest-wiki.ts
  Input:  F:\flow-arts-wiki\content\drafts\*.wiki (181 articles)
  Output: Structured TypeScript data files

  Extraction targets:
  - Glossary definitions (intro paragraphs)
  - Infobox metadata (creators, years, status)
  - Internal cross-references (wiki links)
  - External references (URLs in ref tags)
  - Category assignments
  - Section content by heading
```

The harvest script is a development tool, not a runtime dependency. Run it manually when wiki content changes. Output gets committed to the domain packages.

### Wiki Search Tool

A separate searchable index of all 181 wiki articles for free-text queries:

```typescript
// Built at harvest time
interface WikiArticle {
  title: string;
  sections: { heading: string; content: string }[];
  categories: string[];
  infobox?: Record<string, string>;
  internalLinks: string[];
  externalRefs: ExternalReference[];
}

// Runtime search
searchFlowArtsWiki(query: string, maxResults?: number): WikiSearchResult[]
```

---

## Accuracy Protocol

### Three Tiers of Claims

| Tier | What it is | Standard |
|------|-----------|----------|
| **Sourced fact** | Traceable to specific document/video/person | Must cite source. No meaning-altering paraphrase. |
| **Community consensus** | Widely held understanding, no single source | Flag as community usage, not original system. |
| **TKA interpretation** | How TKA maps/relates to another system | Explicitly frame as TKA's perspective. |

Every data record has a `source` field using the `SourcedClaim` type.

### Build-and-Audit Pipeline

Each knowledge chunk is built by one subagent and audited by another:

1. **Builder subagent** writes a data file from source material
2. **Auditor subagent** verifies every claim against the cited source
3. Issues get fixed and re-audited until clean
4. Wiki cross-check pass compares against existing wiki articles

### Auditor Checklist

- Does every claim trace to a source?
- Does the source actually say what we claim?
- Are community extensions flagged as community, not original?
- Are TKA interpretations framed as TKA perspective, not the other system's view?
- Is anything stated as fact that is actually opinion?
- Does the wiki article on this topic agree or disagree?

---

## Integration

### MCP Server

Existing `tka-domain` MCP server (at `mcp-server/`) renamed to `flow-arts-knowledge` in `.mcp.json`. VTG tools added alongside existing TKA tools. No new process, negligible RAM increase.

**New tools:**

| Tool | Purpose |
|------|---------|
| `get_vtg_pattern` | Look up specific pattern from 40 base set |
| `get_vtg_transition` | Transition theory between categories |
| `get_vtg_shape` | One of 10 minimal beat shapes |
| `get_vtg_category` | Deep dive on SS/TS/SO/TO/QS/QO |
| `get_vtg_contributor` | Person bio and contributions |
| `search_vtg` | Free-text search across VTG knowledge |
| `vtg_to_tka` / `tka_to_vtg` | Bidirectional translation |
| `search_flow_arts_wiki` | Full-text search across 181 wiki articles |

### Tika

Same tools wired directly into `+server.ts` as function imports. No MCP hop. System prompt updated to guide tool selection:

- VTG questions → VTG tools
- TKA questions → existing TKA tools
- Cross-system → translation tools
- General flow arts → wiki search

### Source Corrections

The existing `@tka/domain` VTG data (domain-topics.ts, glossary.ts) gets updated to use the accuracy tiers. Claims currently stated as VTG facts that are actually community extensions get re-sourced.

---

## Future Domains (Not In Scope)

When built, these would follow the same pattern:

| Package | System | Status |
|---------|--------|--------|
| `@caps/domain` | Continuous Assembly Patterns | Future |
| `@9square/domain` | 9-Square Theory | Future |
| `@qft/domain` | QFT Notation | Future |
| `@spin-science/domain` | Lorq's frameworks | Future |

Each would import types from `@flow-arts/core`, get tools added to the same MCP server, and get wired into Tika.

---

## Implementation Order

1. Create `@flow-arts/core` package (types only)
2. Create `@vtg/domain` package scaffold
3. Build wiki harvest script
4. Populate VTG data files (subagents, audited)
5. Add VTG reference functions (public API)
6. Wire into MCP server (rename + new tools)
7. Wire into Tika (+server.ts)
8. Update @tka/domain VTG references for accuracy
9. Full accuracy audit pass
