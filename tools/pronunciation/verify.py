# tools/pronunciation/verify.py
"""Flag words that were read as something other than what was prompted.

Forced alignment cannot catch this: it is told which letters are in the file and
will place them somewhere regardless. Recognition is a genuinely independent
opinion, which is the only kind that helps here. Advisory — it lists words to
listen to, it does not delete anything.
"""

import argparse
import difflib
import json
import pathlib

from faster_whisper import WhisperModel

MATCH_FLOOR = 0.6


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    parser.add_argument("--model", default="small.en")
    args = parser.parse_args()

    model = WhisperModel(args.model, compute_type="int8")
    words = json.loads((args.session / "words.json").read_text(encoding="utf-8"))

    suspect = []
    for entry in words:
        word_id = pathlib.Path(entry["file"]).stem
        expected = (args.session / f"{word_id}.lab").read_text(encoding="utf-8").strip()

        segments, _ = model.transcribe(
            str(args.session / entry["file"]), language="en", beam_size=5
        )
        heard = " ".join(segment.text for segment in segments).strip()

        ratio = difflib.SequenceMatcher(
            None, expected.lower(), heard.lower()
        ).ratio()
        if ratio < MATCH_FLOOR:
            suspect.append({"id": word_id, "expected": expected, "heard": heard,
                            "similarity": round(ratio, 2)})

    report = args.session / "misreads.json"
    report.write_text(
        json.dumps(suspect, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"{len(suspect)} of {len(words)} words look misread — see {report}")
    for item in suspect:
        print(f"  {item['id']}: expected {item['expected']!r}, heard {item['heard']!r}")


if __name__ == "__main__":
    main()
