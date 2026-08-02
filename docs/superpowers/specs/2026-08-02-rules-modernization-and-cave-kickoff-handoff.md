# Rules Modernization + Cave Kickoff — Handoff (2026-08-02)

## Mission

This session did three things: (1) modernized the `.claude/rules/` corpus for
the Fable 5 / Opus 5 era per Anthropic's official migration guidance, (2)
rotated the exposed Cloudflare API tokens found during that audit, and (3)
captured Austen's post-review creative direction for the Vulcan Cave rebuild.
The cave rebuild itself has NOT started — its canonical state-transfer doc is
`docs/superpowers/specs/2026-08-02-vulcan-cave-exhibit-scale-rebuild-handoff.md`
(now including a "Post-handoff direction (2026-08-02)" section). Read that doc
in full before touching any museum code; this handoff only covers what changed
since it was written.

## Done — verified

- **Rules modernization, commit `85d38e9722`** — 16 files, +333/−896. Twelve
  behavioral rules + project `CLAUDE.md` condensed (constraints preserved,
  old-model scaffolding removed); dead unregistered
  `.claude/hooks/post-edit-typecheck.cjs` and inert Playwright-era
  `.claude/config.json` deleted. Evidence: `git show --stat 85d38e9722`.
  Per-file verdicts and the deliberately-untouched list:
  `docs/superpowers/specs/2026-08-02-rules-modernization-fable5.md`.
- **Cloudflare token rotation, commit `4c8f7de6fb`** — the exposed active
  token was `tka-assets-r2` (id `b5333152b69979585b5c97379d9306f5`), NOT the
  "Claude r2 uploader" its wrangler usage suggested; identity confirmed via
  the dashboard session's `/api/v4/user/tokens` listing. Rolled twice in the
  dashboard (first roll's value leaked into a screenshot, so it was burned and
  rolled again blind). Evidence, all from `/user/tokens/verify` on
  2026-08-02: old value `19gU…` → `Invalid API Token`; burned intermediate
  `cfut_yity…` → `Invalid API Token`; new value → `active`, same id. The
  second exposed value `1Zsg…` was already invalid before this session.
- **New token stored** in gitignored `E:\tka-platform\.env` as
  `CLOUDFLARE_API_TOKEN=` (verified `git check-ignore .env` →
  `.gitignore:107`). It appears nowhere in any transcript or commit.
  Clipboard was cleared afterward.
- **Prod safety check** — the Firebase secret `CLOUDFLARE_API_TOKEN` used by
  `firebase-functions/src/syncShortcodeToKV.ts` was compared programmatically
  (never printed): it is a DIFFERENT value, so the roll could not break the
  shortcode→KV sync.
- **Memory updated** — `reference_fable5_opus5_tuning.md` and `MEMORY.md`
  index now record the rules-trim as done (commit `85d38e9722`).

## Believed done — unverified

Nothing. All claims above carry evidence.

## In flight

Nothing uncommitted from THIS session. The working tree is heavily dirty with
OTHER sessions' concurrent work (agent-hub, CAPS, browse/gallery, museum) —
do not stage, commit, or revert any of it. `main` holds 10+ local commits
ahead of `origin/main` from multiple sessions (choreo, shop, Lane 2,
this session's two). **Do not push without confirming ownership of every
unpushed commit** — pushing publishes other sessions' work.

## Loose ends (ranked)

1. **Water-slice brainstorm for the Vulcan Cave.** The next real work.
   Start from the cave handoff + its 2026-08-02 direction addendum, invoke
   `superpowers:brainstorming`, and produce the revised spatial program and
   Water art target (loose ends #1–2 of the cave handoff). Implementation
   still requires Austen's explicit approval first.
2. **Verify letter↔mode groupings via flow-arts MCP** when speccing the
   pedagogy arc (Austen's stated examples: Water → A, B, C; Earth → G, H, I).
   Cave pictographs stay pre-alphabetic; no Latin letters on walls.
3. **`settings.local.json` untracking decision (Austen's call, flagged not
   done).** The file is git-tracked — the root cause of tokens reaching
   version control. `git rm --cached` + gitignore fixes it, but a pull on
   another machine could delete an unmodified local copy there, wiping that
   machine's accumulated permissions. Present the tradeoff; don't do it
   unprompted.
4. **Skills/agents prescriptiveness pass** — deliberately scoped out of the
   rules trim (they load on-demand; cost nothing until invoked). Policy:
   fix-on-touch, no sweep.
5. Stale `mcp__playwright__*` allow entries remain in `settings.local.json`
   (harmless; prune opportunistically when the untracking question is
   settled).

## Decisions already made

- **Rules trim philosophy (2026-08-02):** constraints and project facts stay;
  only old-model babysitting form was removed. Canon-dense rules and
  July-2026 rules (visual-verification, fable-routing, resource-budget) were
  deliberately left alone. Don't re-trim them without new evidence.
- **Cave scene reuse = systems/atmosphere tech, not wholesale scenes**
  (Austen, 2026-08-02): ocean water shaders for Water, Ember fire systems for
  Fire, lunar lighting for Moon, forest/desert vocabulary for Earth — inside
  the continuous cave fiction with gates and habitat bays.
- **Immersive thresholds** ("suddenly underwater") and the **six-room
  pedagogical arc** (each room teaches its mode's letter variations as hand
  paths) — see the cave handoff's direction addendum for exact wording.
- **One room at a time.** Water first; no broad-brushing all six.
- Token rotation approach (2026-08-02): roll-in-place keeping name and
  permissions; live secrets transfer via clipboard→file, never through chat.

## Gotchas

- The Cloudflare dashboard SPA does not change its URL when opening token
  edit views, and list-row clicks on token names do nothing — use the row's
  "…" Actions menu, and confirm token identity via
  `fetch('/api/v4/user/tokens', {credentials:'include'})` from the page
  context, not the UI.
- After a token roll, the success dialog displays the new value —
  **screenshots of that dialog leak the secret into the transcript.** The
  working pattern: confirm dialog geometry once on a throwaway roll, then
  roll again and click Copy + Done blind by coordinates, verifying via
  clipboard prefix/length check in PowerShell.
- `/user/tokens/verify` counts as a "use" — a fresh `last_used` timestamp on
  a token may just be your own verify call.
- The rules files were rewritten wholesale on 2026-08-02; any session started
  before then has the OLD corpus in context. Diffs against memory of the old
  wording are expected, not regressions.
