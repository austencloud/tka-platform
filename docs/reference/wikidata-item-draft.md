# Wikidata Item Draft — The Kinetic Alphabet (2026-07-14)

Ready-to-submit draft for creating a Wikidata item. Wikidata feeds Google's
Knowledge Graph and LLM training/RAG — this is the durable entity + AI-citation
bet. Create at https://www.wikidata.org/wiki/Special:NewItem (needs a free
Wikidata account).

## Notability — read first (honest)

Wikidata HAS a notability bar (the off-page kit was wrong that it has none). An
item qualifies if it meets ONE of: (a) a sitelink to any Wikimedia project, (b)
"clearly identifiable + described in reliable public sources," or (c) a
structural need. We're going for (b). Right now the independent sourcing is thin
(one editorial + festival mentions), so the item is **create-able but at some
deletion-nomination risk** until 2-3 more independent reliable-source mentions
exist. Best sequence: land a couple of the Tier-1 outreach mentions (Home of Poi,
Flow Arts Institute, a blog feature), THEN this item is solid. You can create it
now with the sources below; just know it strengthens as press accrues.

## Labels / descriptions / aliases

- **Label (en):** The Kinetic Alphabet
- **Description (en):** notation system and web app for flow arts choreography
- **Also known as (aliases, en):** TKA · Flow Arts Notation · Kinetic Alphabet ·
  Flow Arts Composer

## Statements (property → value)

Use Wikidata's autocomplete to resolve each value to its QID — don't hand-type
QIDs. Where a value has no Wikidata item yet, skip it (noted below).

| Property | Value | Notes |
|---|---|---|
| instance of (P31) | notation system | pick the closest existing item via autocomplete |
| instance of (P31) | web application | second P31 value is fine |
| inception (P571) | 27 March 2022 | precise date |
| official website (P856) | https://tkaflowarts.com/ | |
| country of origin (P495) | United States of America | |
| YouTube channel ID (P2397) | `UCbLHNRSASZS_gwkmRATH1-A` | stable channel ID — unaffected by the @handle change |
| Instagram username (P2003) | tkaflowarts | your live account |
| Facebook ID (P2013) | tkaflowarts | confirm this is the live Page slug |
| field of work (P101) | flow arts | ONLY if a "flow arts" item exists; if not, skip (or use "juggling"/"object manipulation" as the nearest) |
| creator (P170) | Austen Cloud | needs a person item; skip if none exists yet, add later |

## References (attach to statements — unreferenced statements get reverted)

Attach "reference URL (P854)" + "retrieved (P813)" to the factual statements,
citing:
- https://www.sourcetype.com/editorial/28285/kinetic-scripts-the-visual-language-of-dance-notation (editorial describing TKA/dance notation)
- https://tkaflowarts.com/ (official site — supports website/inception/instance-of)
- Midwest Flow Fest teaching it: https://www.instagram.com/flowfests/reel/C_wIy3dPe1Y/ (weak source, but corroborates real-world use)

## After creating

- Add the Wikidata item URL to the site's `Organization.sameAs` (I'll wire it).
- Set `sameAs` on the item back to your socials so the entity graph closes.
- This is the anchor DefinedTerm schema + AI citations key off. It compounds.
