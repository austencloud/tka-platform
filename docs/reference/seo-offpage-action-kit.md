# Off-Page Discovery Action Kit (2026-07-14)

On-page SEO for tkaflowarts.com is done (schema, sitemap, robots, canonicals,
pillar pages, keyword roadmap — see `seo-content-roadmap.md`). The ranking
ceiling now is **off-page: backlinks, mentions, and entity signals.** Google
ranks a niche head term like "flow arts notation" by *authority*, and TKA has
almost none yet — near-zero sites reference it. Nothing on-page fixes that.

This kit turns that lever from "someday, vague" into copy-paste work. Ordered by
leverage ÷ effort. Metrics deliberately omitted — no fabricated DR/traffic
numbers; judge by relevance.

---

## Tier 1 — do these first (community links that will actually land)

Real flow-arts communities. A link or mention from any of these teaches Google
"TKA = flow arts notation." Lead with the *thing that's genuinely novel* (a
written notation system for prop flow), not "check out my app" — communities
reward the idea, not the pitch.

| Target | Type | Angle to lead with | Who does it |
|---|---|---|---|
| **r/flowarts** (reddit) | Subreddit | "I built a written notation system for staff/flow — here's how it reads on a page." Show a pictograph, not a landing page. | You (his voice) |
| **Home of Poi** (homeofpoi.com forum/community) | Forum | Same, framed for the poi/staff old-guard. Siteswap folks respect notation. | You |
| **r/juggling** (reddit) | Subreddit | "Siteswap for jugglers has an analog for prop flow now." Borrows the notation-literate audience. | You |
| **Flow Arts Institute** (flowartsinstitute.com) | Nonprofit / resource hub | Ask to be listed as a resource / write a guest piece on notation. A link here is a strong topical signal. | You (outreach email) |
| **DrexFactor** (Drex — flow arts educator/blog) | Educator | He already ranks for flow-arts terms and writes about notation history (siteswap). A mention/collab is gold. | You (outreach) |
| **Flow arts Discord servers + FB groups** (Flow Arts, Staff Spinning Community) | Social | Share a sequence, link back. Ongoing, not one-shot. | You |

Rule: post the *pictograph/sequence image* first. Visual proof of the system
converts; a URL alone reads as spam and gets removed.

---

## Tier 2 — entity signals (teach Google/AI that TKA is a real *thing*)

These build the Knowledge-Graph entity behind "The Kinetic Alphabet." AI search
(ChatGPT, Perplexity, Google AI Overviews) leans heavily on these.

1. **Wikidata item** for "The Kinetic Alphabet" — free, high-signal, no notability
   bar like Wikipedia. Create the item (needs your Wikidata account); the exact
   statements to add are drafted below. This is the single highest-leverage
   entity action.
2. **`Organization.sameAs`** in `src/routes/+page.svelte` — Instagram, Facebook,
   and **YouTube** (`@TheKineticAlphabet`, added 2026-07-14) are wired. Still to
   add when they exist: TikTok, Reddit profile, Pinterest, LinkedIn, and the
   Wikidata item URL once created. → *Give me the URLs and I wire them in; I
   won't invent handles.*
3. **AlternativeTo / tool directories** — list Flow Arts Composer as an app.
   Free backlink + a discovery surface for "flow arts choreography software."

### Wikidata statements to paste (draft — verify each before submitting)
- **Label:** The Kinetic Alphabet
- **Also known as:** TKA, Flow Arts Notation, Kinetic Alphabet
- **Description:** notation system and web app for flow arts choreography
- **instance of (P31):** notation system; web application
- **subclass of / field (P101 or P921):** flow arts; movement notation
- **inception (P571):** 2024
- **official website (P856):** https://tkaflowarts.com/
- **Instagram (P2003):** tkaflowarts · **Facebook (P2013):** tkaflowarts
- **YouTube channel (P2397):** needs the `UC…` channel ID — handle is
  `@TheKineticAlphabet` (grab the UC ID from the channel's Advanced settings /
  page source); add TikTok once known

---

## Tier 3 — one-shot launch spikes (bursts of traffic + links)

The app + the notation-system story can carry a launch on general-tech audiences,
not just flow arts:

- **Show HN (Hacker News)** — "Show HN: A written notation system for prop
  flow/juggling, with a web editor." The creative-coding / juggling-math crowd
  on HN responds to novel notation. One good thread = real backlinks + eyeballs.
- **Product Hunt** — launch Flow Arts Composer. Backlink + a spike; schedule for
  a Tue–Thu.
- **YouTube: one "what is flow arts notation" explainer** on your channel. Video
  is the format flow arts searches actually want; it also ranks in Google video
  results for the exact term you want to own.

---

## Tier 4 — technical, automatable (modest leverage; I can do these)

Honest framing: these help at the margin, they do NOT get an unranked page
discovered. Not the genius move — do after Tiers 1–3.

- **IndexNow** — auto-ping Bing/Yandex/DuckDuckGo/Ecosia (and, increasingly,
  AI search that rides Bing's index) on every publish. Automates for the Bing
  ecosystem what I did by hand in Google Search Console. ~1 endpoint + a key
  file. I can build it.
- **Bing Webmaster Tools** — submit the sitemap there too (needs your Microsoft
  sign-in; I can drive the browser like I did GSC once you're signed in).
- **Core Web Vitals** — GSC shows "No data" (low traffic, not a problem yet). A
  Lighthouse pass on `/notation` is cheap if you want a speed baseline, but speed
  won't move an undiscovered page.

---

## The one honest sentence

Every technical lever is pulled or marginal. The needle moves when other flow
arts sites and communities start pointing at TKA. Tier 1 is a weekend of
posting; it will do more than any code I could write.
