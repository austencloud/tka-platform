# tools/pronunciation/align.py
"""Run MFA over a recording session directory.

MFA 3.0 keeps an HMM-GMM acoustic model, which is why it is here: its mean
boundary error is under 15 ms, where end-to-end neural ASR with word timestamps
is worse at frame-level placement because it is trained for string accuracy.
"""

import argparse
import pathlib
import subprocess
import sys

DICTIONARY = pathlib.Path(__file__).with_name("tka-letters.dict")
ACOUSTIC_MODEL = "english_us_arpa"


def run(command: list[str]) -> None:
    print(" ".join(command))
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    parser.add_argument("--out", type=pathlib.Path, default=None)
    args = parser.parse_args()

    out = args.out or args.session / "aligned"
    run(["mfa", "validate", str(args.session), str(DICTIONARY), ACOUSTIC_MODEL])
    run([
        "mfa", "align",
        str(args.session), str(DICTIONARY), ACOUSTIC_MODEL, str(out),
        "--clean", "--fine_tune",
    ])
    print(f"TextGrids in {out}")


if __name__ == "__main__":
    main()
