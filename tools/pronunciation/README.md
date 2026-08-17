<!-- tools/pronunciation/README.md -->
# Pronunciation corpus — offline stage

The browser writes an MFA corpus: `NNN.wav` + `NNN.lab` per word, plus
`words.json` and `session.json`.

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

The dictionary is `tka-letters.dict`. If `mfa validate` reports OOVs, add them
there; a name the aligner cannot look up gets `<unk>` and its word aligns
against a phone set it never spoke.

## Miniconda is a prerequisite, and is not installed on this machine yet

Every command above runs inside the `tka-pronunciation` conda environment.
Montreal Forced Aligner ships compiled Kaldi binaries, which pip cannot
provide — there is no wheel that gets you a working aligner, so the system
Python is not an option and neither is a venv.

Install Miniconda first (https://docs.conda.io/projects/miniconda/), then run
the `conda env create` line above. Until that is done, `align.py`,
`cut_tokens.py`'s test suite, and `verify.py` cannot be executed here; the
files are written and syntax-checked, but unrun.
