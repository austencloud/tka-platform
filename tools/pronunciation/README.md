<!-- tools/pronunciation/README.md -->
# Pronunciation corpus — offline stage

The browser uploads to Firebase Storage under
`pronunciation-corpus/{uid}/{sessionId}/` — the reader is never asked to pick a
folder. Pull a session down first; it lands as the MFA corpus the rest of this
pipeline expects (`NNN.wav` + `NNN.lab` per word, plus `words.json` and
`session.json`), and the command errors if fewer words arrive than the session
recorded.

    node scripts/fetch-pronunciation-session.mjs <uid>
    # -> tools/pronunciation/sessions/<sessionId>

Then:

    conda env create -f tools/pronunciation/environment.yml
    conda activate tka-pronunciation
    mfa model download acoustic english_us_arpa
    mfa model download dictionary english_us_arpa

    python tools/pronunciation/align.py <session-dir>
    python tools/pronunciation/cut_tokens.py <session-dir>
    pnpm exec tsx scripts/build-token-bank.ts <session-dir>
    python tools/pronunciation/verify.py <session-dir>

`align.py` writes TextGrids. `cut_tokens.py` cuts each letter out of the 48 kHz
WAV and writes a partial bank. `build-token-bank.ts` measures the features and
writes the v2 bank — in TypeScript, because `audio-features.ts` is the tested
implementation of F0 and a second one in Python would drift from it.
`verify.py` flags misreads and is advisory.

The dictionary is `tka-letters.dict`, and it is closed — MFA looks up nothing
else, so every token a `.lab` can hold is defined there. The Greek letters are
read in the shorthand (`sig`, `del`, `the`, `ome`, `phi`, `psi`, `lam`, `alp`,
`bet`, `gam`), which is why the dictionary carries them and not `Sigma`: hand
the aligner a full name for a recording of a short one and it places boundaries
on audio that is not there. `Θ` is entered with two pronunciations, `TH EY1` and
`TH EH1`, because "the" as shorthand for theta has no settled vowel. If
`mfa validate` reports OOVs, add them there.

## Miniconda is a prerequisite, and is not installed on this machine yet

Every command above runs inside the `tka-pronunciation` conda environment.
Montreal Forced Aligner ships compiled Kaldi binaries, which pip cannot
provide — there is no wheel that gets you a working aligner, so the system
Python is not an option and neither is a venv.

Install Miniconda first (https://docs.conda.io/projects/miniconda/), then run
the `conda env create` line above. Until that is done, `align.py`,
`cut_tokens.py`'s test suite, and `verify.py` cannot be executed here; the
files are written and syntax-checked, but unrun.
