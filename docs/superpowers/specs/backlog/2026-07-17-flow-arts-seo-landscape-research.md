# Flow Arts Search Landscape — Research & SEO Verdict

**Date:** 2026-07-17
**Status:** Research findings / strategy memo (no work scheduled yet)
**Trigger:** Austen searched "flow arts app," his app didn't surface (the AR trail-effect
app ranks instead), and asked whether SEO optimization is worth continued effort or
whether the time is better spent elsewhere. A prior agent had told him "nobody Googles
this, everyone's on Instagram."
**Methods:** deep-research workflow (103 agents, adversarial-verified web landscape) +
Ahrefs free Domain Rating endpoint (live pull). **Ahrefs keyword-volume API was
plan-gated** (`Insufficient plan`) — exact monthly search volumes could NOT be measured.

---

## TL;DR verdict

**Broad "flow arts" head-term SEO is NOT worth the time. But the reason TKA doesn't rank
has almost nothing to do with keywords — it's near-zero backlink authority (DR ≈ 0).**
That reframes the question: TKA isn't losing a keyword fight, it's not *in* the fight,
because Google has no external signal the app exists.

The "nobody Googles this" agent was half-right (discovery does skew social/video) and used
it as a cop-out — "low search volume" and "you're invisible on Google" are two different
problems, and TKA's actual problem is the second, which is cheap to fix.

**Do this (small, once, then walk away):**
1. Fix DR 0 — get 5–10 real backlinks (few hours). Highest leverage by far.
2. Own the empty composition/notation niche with ONE high-intent landing page (half a day).
3. Route the rest of the reach budget to social/video + the festival community, not SEO.

**Do NOT:** try to rank for `flow arts` / `flow arts app` as head terms.

---

## 1. Do people even Google this?

**Limitation up front:** exact keyword volumes are behind the Ahrefs plan paywall
(`Insufficient plan` on every `keywords-explorer-*` call). The structure below is
well-supported; the specific digits are estimates, explicitly labeled.

- **Category is small and in-person by nature.** Flow Arts Institute (leading nonprofit)
  runs ~7 festivals/year, 50+ historically. Top names have followings in the *tens of
  thousands*, not millions (DrexFactor ~46K, FAI ~23K). This caps total addressable
  search volume regardless of exact keyword figures.
- **Discovery migrated to social/video.** Gen Z product discovery: Instagram 30.4% and
  TikTok 23.2% both beat Google 18.8%. Flow arts has been video-native since the ~2005
  YouTube era.
- **The "big uptick in flow arts search in the last year" claim is UNVERIFIED.** Google
  Trends was not queryable through available tools; the workflow did not confirm a
  specific 12-month spike either. The secular growth narrative is well-documented, but a
  recent sharp spike should be treated as unconfirmed, not a fact to build on.

**Estimated term cluster (ESTIMATE, not measured):**

| Term | Intent | Likely US volume | Note |
|---|---|---|---|
| `flow arts` | mixed / info | low thousands/mo | recognized term, still niche |
| `flow arts app` | high, TKA's | very low (tens/mo) | compound niche query — tiny |
| `poi` | ambiguous | high but poisoned | collides with Hawaiian *food* poi |
| `learn poi` / `poi tutorial` | high, clean | low–mid hundreds/mo | the real intent terms |
| `staff spinning`, `poi tricks` | info | hundreds/mo | tutorial-owned |

Shape matters more than digits: head terms are low-volume *and* poisoned by ambiguity or
owned by free-tutorial incumbents; the clean-intent terms are all long-tail.

---

## 2. Who owns the SERP — and why TKA is buried (HARD DATA)

Domain Rating (0–100, backlink authority, logarithmic — Ahrefs free endpoint, pulled
2026-07-17). **NOTE: the free unauthenticated endpoint sunsets 2026-08-01 and will then
require a free API key.**

| Domain | DR | Lane |
|---|---:|---|
| homeofpoi.com | 49 | retail + tutorials (since 1998) |
| flowtoys.com | 45 | retail |
| flowartsinstitute.com | 38 | community/nonprofit |
| playpoi.com | 29 | free tutorials |
| ultrapoi.com | 28 | retail |
| taylorflows.com | 21 | **app peer** (tutorials) |
| spinmorepoi.com | 4.4 | tutorials |
| flowpath.to | 0 | **app peer** (new) |
| tkaflowarts.com | 0 | **TKA** |
| flowartscomposer.com | 0 | **TKA** |
| tka.run | 0 | **TKA** |

**Two findings:**

1. **TKA's DR is ~0 on all three domains.** DR is driven by other sites linking in.
   Austen's own words: "nobody's really written about my shit on their own page." Google
   agrees — that's the literal mechanism behind "ranks it low." With DR 0 you won't
   outrank a DR-45 retailer for "flow arts." This confirms the diagnosis and names the
   lever: **get linked to.**
2. **TKA's real competitive lane is wide open.** Head-term incumbents (DR 38–49) sell gear
   and teach tricks — none do sequence composition or notation. TKA's actual peers are the
   *app* entrants (Taylor Flows DR 21, FlowPath DR 0, AR Flow Arts which ranks on the
   Google Play listing's borrowed authority, not its own site). **None do
   composition/notation.** The niche is empty.

---

## 3. Two lanes, opposite verdicts

- **Retail / head-term lane** (`flow arts`, `poi`, `learn poi`): DR 28–49 walls,
  free-content incumbents, ambiguous terms. **Don't compete.**
- **App / composition lane** (`flow arts app`, `poi sequence maker`, `poi notation`,
  `flow sequence generator`, `TKA alphabet`, specific trick+prop combos): peers are
  DR 0–21, composition angle unoccupied. **Winnable, and it's a weekend not a quarter.**

---

## 4. Recommended actions (sized)

1. **Fix DR 0 (~a few hours, highest leverage).** Land 5–10 real links: FAI listing,
   r/flowarts / r/poi post, DrexFactor / flowarts.life mention, Product Hunt launch,
   festival vendor pages, flow Discord/wiki. Each link outweighs any on-page tweak.
2. **Own the empty niche (one page, ~half a day).** A single strong landing page for
   "flow arts sequence composer / poi notation / trick sequence generator." Ranks because
   no one else is there, and it's high-intent — searchers want exactly what TKA is.
3. **Everything else → social/video + festival community, not SEO.** Short clips of the
   composer generating a sequence are worth more than any blog post.

**Not worth doing:** ranking for `flow arts` / `flow arts app` head terms (low volume,
wrong authority, wrong medium).

---

## Is a paid SEO plan (Ahrefs etc.) worth it? — NO (verdict 2026-07-17)

A recurring paid plan is NOT worth it for this niche. Reasoning:

1. **More data won't move a decision.** The strategic picture (niche, social-first,
   DR-0 blocker, empty composition niche) is already firm. Precision on low-volume terms
   changes nothing.
2. **Paid data is least reliable at the sub-100/mo tail** — tools round to 0/10/20 and
   disagree by multiples; Ahrefs is the conservative one, so many niche terms show as
   `0`/`N/A`. Worst-case input for a premium tool.
3. **Free stack covers ~90%, incl. ground truth paid tools can't give:** Google Search
   Console (real queries/impressions/positions for owned site — beats any estimate for a
   DR-0 site), Ahrefs Webmaster Tools (free: Site Explorer + Site Audit + backlink profile
   for owned domains), Google Keyword Planner (free: volume *ranges* for the §1 cluster).
4. **Bottleneck is execution, not analysis** — backlinks, one landing page, social.

**The one legitimate paid use:** competitor backlink intelligence (pull referring-domain
lists of homeofpoi / flowtoys / flowartsinstitute → replicate their links). Free AWT can't
(owned domains only). Do it as a ONE-TIME export: check if the current Ahrefs login's web
UI already allows it (API gate ≠ web-UI gate), else $29 Starter for one month, export,
cancel. Not a recurring commitment.

Ahrefs pricing 2026 (for reference): Starter $29 / Lite $129 / Standard $249 /
Advanced $449 per month; no free trial. Ahrefs Webmaster Tools free for verified owners.

## Go-to-market / backlink game plan (Austen, 2026-07-17)

The DR-0 problem is solved by shipping + getting known + getting carried, NOT by on-page
optimization. Two engines, different jobs — don't conflate them:

- **Awareness engine (social):** Reddit, YouTube, Instagram, Facebook. These are
  reach/traffic + branded-search generation + discovery. Outbound links on all of them are
  `nofollow`, so they do NOT directly move Domain Rating. Post anyway — they prime the pump
  and create the branded searches TKA ranks #1 for instantly.
- **DR engine (editorial/shop links):** blogs, festival vendor pages, directories, wikis,
  Product Hunt, and above all **retailers/shops that carry the product and link to it.**
  These are `dofollow` from relevant sites — the actual fuel that moves DR 0 → ranking.

**Flow Toys (warm offer, high priority):** they offered to include TKA in their email
chain. Email = reach, NOT a backlink (not crawled). While warm, ALSO ask for a **link on
flowtoys.com** (partners page / "tools we love" / blog). A dofollow link from a DR-45 site
that is the most topically relevant domain in the space is worth more than a hundred social
posts. Ask for both.

**Phased flywheel (correct order):**
1. **Release** — nothing can link to a thing that isn't out. Unblocks everything.
2. **Post everywhere** (Reddit r/flowarts + r/poi, YouTube, IG, FB) — awareness + branded
   search + discovery.
3. **Convert warm relationships into SITE links** — Flow Toys link, festival sites,
   DrexFactor / flowarts.life mentions, r/flowarts wiki, Product Hunt launch.
4. **Product in shops** — every retailer carrying the loop deck + linking to it is a
   relevant dofollow link that compounds. Distribution and backlinks in one move; this is
   the phase that makes TKA un-buryable.

## Open items / how to close the volume gap later

- **Exact search volumes** — Google Keyword Planner (free, ranges only without ad spend),
  Semrush free tool, or Keywords Everywhere. The Ahrefs
  `keywords-explorer-overview` / `matching-terms` / `related-terms` endpoints are ready to
  run IF the plan is ever upgraded to include API units — the §1 cluster is the query list.
- **Trends "uptick"** — verify directly at trends.google.com for the exact term
  `flow arts`, US, past 5 years vs past 12 months, before citing any growth spike.

---

## Sources

- Flow Arts Institute festivals — https://flowartsinstitute.com/festivals/
- Gen Z discovery (Instagram/TikTok > Google) — https://smk.co/instagram-tiktok-surpass-google-for-gen-z-shoppers/
- Home of Poi history / social migration thesis — https://flowarts.life/2021/06/21/what-happened-to-home-of-poi/
- Home of Poi (incumbent) — https://www.homeofpoi.com/us/
- Playpoi (free tutorials) — https://playpoi.com/learn/
- Taylor Flows (app peer) — https://app.taylorflows.com/
- FlowPath (app peer) — https://www.flowpath.to/
- AR Flow Arts (the app that ranks for "flow arts app") — https://play.google.com/store/apps/details?id=com.arflowartsreact
- Domain Rating data — Ahrefs free endpoint, http://ahrefs.com/legal/domain-rating-license
