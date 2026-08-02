# Android Launcher Icon — TKA Wordmark Design (2026-07-19)

## Decision context

Austen's direction (2026-07-19, on-device iteration session):

- Icon shows the **TKA** acronym. App label stays **Composer** (launchers
  truncate at ~10–11 chars; "Flow Arts Composer" rendered "Flow Arts Comp…").
- Use a lovely serif, not Arial Black ("boring text"). Candidates in repo:
  - **Fraunces 700 italic** — `static/fonts/fraunces/` — documented in
    `static/fonts/css/fraunces.css` as "the brand wordmark voice"
    (SiteHeader wordmark).
  - **Playfair Display 500** — `static/fonts/playfair/` — the guide serif.
- Minimize dead white space. Prior attempt = small mandala + big white field;
  rejected.
- Mandala = system art. Canonical crop: top-left quadrant of
  `static/pwa/icons/icon-1024x1024.png`, ink bbox `left:134 top:117 w:370 h:377`.
  Brand colors sampled from it: red `#EC1018`, blue `#2E3192` (approx; sampled
  navy `#0B1D2A` is the PWA maskable bleed color).

## Hard constraints (Android adaptive icons)

- Canvas 108dp; launcher shows center **72/108 = 66.7%** ("visible window").
  Everything that must not clip lives inside the central 66.7% of the 1024px
  source. Circle-mask safe zone is the inscribed 61% circle — Samsung One UI
  (Austen's Fold 6) uses a squircle, Pixel uses a circle. Optimize squircle,
  accept minor circle clipping.
- Deliverables per icon: `resources/icon-foreground.png`,
  `resources/icon-background.png` (both 1024×1024), `resources/icon-only.png`
  (legacy/pre-8.0 + round). Then:
  `npx @capacitor/assets generate --android --assetPath resources`
  writes all mipmap densities into `android/app/src/main/res/`.
- Build: `cd android && JAVA_HOME="C:\Program Files\Android\Android Studio1\jbr" ./gradlew assembleDebug`
  (system JDK fails with "invalid source release: 21").
  Install: `adb -s RFCY30FJN5D install -r android/app/build/outputs/apk/debug/app-debug.apk`.
- Never upscale raster sources — compose at 1024 from the 1024 PWA art or from
  vector (font → SVG path via `opentype.js`, in repo node_modules). Fonts are
  woff2 locally; woff (v1) fetched from Google Fonts parses fine with
  opentype.js. Local copies in the session scratchpad
  (`fraunces-700i.woff`, `playfair-600.woff`).

## The six concepts (rendered 2026-07-19, contact-sheet-v4)

| # | Layout | Notes |
|---|---|---|
| A | White bg, mandala top, **Playfair** navy TKA below | Guide-font voice; classic |
| B | White bg, mandala top, **Fraunces 700i** navy TKA below | Brand wordmark voice |
| C | Mandala zoomed past the bubble (arms bleed off edges), white badge with Fraunces TKA centered | Boldest use of the art; least white |
| D | **Navy bg**, mandala on white rounded chip, white Fraunces TKA below | Highest shelf contrast; matches app's dark aesthetic; zero boring white |
| E | White bg, giant Fraunces TKA only — T red / K navy / A blue (prop colors) | Most readable from afar; no mandala |
| F | Pure mandala, no text | Classic app-glyph route; label carries the name |

Claude's recommendation: **D** (runner-up B). Rationale: home screen neighbors
are mostly white/bright bubbles — navy pops; white serif at launcher size is
the highest-contrast readable treatment; no dead white.

**Chosen + shipped: F** (Austen, 2026-07-19). Pure mandala, no text — the
label carries "Composer". Mandala sized to ~652px foreground (fills the
66.7% launcher window with slight air), kept fully opaque on white paper so
the red/blue arrows stay vivid (the alpha-from-darkness knockout dimmed them
to pastel — first attempt discarded). Verified on the Fold 6 home screen:
big vivid mandala filling the squircle, full "Composer" label.
Render script: session scratchpad `build-F.mjs`.

## Codex handoff (if generative art route is chosen)

Codex/GPT image generation can produce richer painterly icons. Constraints to
pass along verbatim:

- Output ≥1024×1024, content composed for the central 66.7% visible window.
- Must include "TKA" as dominant, readable-from-afar text; serif preferred
  (Fraunces italic reference: SiteHeader wordmark at tkaflowarts.com).
- Brand palette: navy `#0B1D2A`, red `#EC1018`, blue `#2E3192`, white.
- Mandala reference image: `static/pwa/icons/icon-1024x1024.png` (or the
  top-left-quadrant crop). Keep the pictograph arrow language — do not invent
  generic mandalas.
- Deliver flat PNG; Claude runs the `resources/` + `@capacitor/assets` +
  gradle pipeline above to ship it (foreground/background split: solid bg
  color layer + content layer, seams invisible when colors match).

## Related

- PWA icons (`static/pwa/icons/`) and `static/pwa/manifest.webmanifest`
  `short_name` still show old art / 18-char name. Follow-up: regenerate PWA
  set from the chosen concept + `short_name: "Composer"` (ships to prod web
  on push — Austen approves separately).
- Commits already landed this session: `2d5d3829b8` (first icon pass),
  `72994117bf` (size/blur fix), `c94d5d5ea7` (Arial TKA v1 — superseded by
  this spec's outcome).
