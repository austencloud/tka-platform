---
name: qr
description: Use when the user wants a QR code for a sequence — "give me a QR for X", "hand me the QR code", "QR I can scan", "make this scannable", a tka.run share link, or testing a card scan flow. Resolves a word/id/short code to a tka.run URL, renders the branded QR locally, and opens it on screen.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# QR Code for a Sequence

When explicitly invoked, treat the text after `$qr` as `<arguments>`. Expected shape: `[word | sequenceId | shortCode | tka.run URL]`.

**Args:** `<arguments>`

One command turns "sequence X" into a scannable QR on screen. Everything is
handled by `scripts/generate-qr.mjs` — do not hand-roll QR generation, short
code minting, or browser-based rendering.

## Run it

```powershell
node scripts/generate-qr.mjs <input>
```

Run from the repo root (Firestore auth resolves `./serviceAccountKey.json` or
`~/.tka/credentials.json` relative to cwd). Requires Node ≥ 23.6 (native TS
type-stripping for the word-simplifier import) — this machine runs Node 24.

**Input forms** (the script auto-detects):

| Input | Behavior |
|---|---|
| Word (`CAKE`, `Ω-YΩX`) | Finds an existing shortcode or public sequence for the word — including expanded LOOP forms (`Ω-YΩX` matches a stored `Ω-YΩXΩ-YΩXΩ-YΩXΩ-YΩX`) |
| publicSequences doc id | Resolves directly, mints a code if none exists |
| Short code (`4LM1`) | Reuses it verbatim |
| `tka.run/...` URL | Extracts the code, no Firestore |
| `--url <anything>` | QR for an arbitrary URL, no Firestore |

**Flags:** `--out <file.svg>` (default `%TEMP%\tka-qr\<CODE>.svg`), `--no-open`,
`--dark` (white modules, transparent background — for dark cards).

The script opens the SVG in the default viewer automatically and prints the
short URL. It never mints duplicate codes: existing shortcodes are reused by
code, by word, and by sequenceId (minting itself is delegated to
`scripts/create-shortcodes-batch.js`).

## After it runs

1. Give Austen the link as clickable markdown: `[tka.run/CODE](https://tka.run/CODE)`
   — always `https://`, per the clickable-links rule.
2. Report the simplified word + code the script printed (words are already
   simplified via `simplifyRepeatedWord`; never print the expanded form).

## Failure modes

- **"No public sequence found"** — the sequence lives only in a user library.
  Options: publish it, pass the exact publicSequences id, or `--url` a direct
  link. Don't guess at ids; query Firestore
  (`scripts/lib/firestore-provider.js`) to find it.
- **Multiple shortcodes for one word** — the script uses the first and lists
  the rest. Fine for "show me a QR"; if Austen is picking a canonical code for
  print, show him the list.
- **Auth error** — `serviceAccountKey.json` missing from repo root and no
  `~/.tka/credentials.json`. Ask Austen; don't work around it.

## Related plumbing (read only if extending)

- In-app generator (browser-only, same branding this script mirrors):
  `src/lib/shared/qr/services/qr-code-generator.ts`
- Short code manager (browser): `src/lib/shared/qr/services/short-code-manager.ts`
- Scan-side landing: `src/routes/q/[code]/`
- The play badge is composited post-render because native `canvas` isn't built
  on this machine; QR uses errorCorrectionLevel H so the badge occlusion is
  safe (verified by rasterize+decode).
