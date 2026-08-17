# tools/pronunciation/cut_tokens.py
"""Cut per-letter tokens out of aligned session audio.

Writes the token WAVs and a partial bank. The acoustic features are added by
scripts/build-token-bank.ts rather than here: audio-features.ts is the tested
implementation of F0 estimation, and a second one in Python would drift from it
in exactly the way that produces a bank that plays but selects badly.
"""

import argparse
import json
import pathlib

import soundfile
from praatio import textgrid

MARGIN_SECONDS = 0.02


def spans_from_textgrid(path: pathlib.Path) -> list[tuple[str, float, float]]:
    grid = textgrid.openTextgrid(str(path), includeEmptyIntervals=False)
    tier = grid.getTier("words")
    return [
        (entry.label, entry.start, entry.end)
        for entry in tier.entries
        if entry.label.strip()
    ]


def position_at(index: int, length: int) -> str:
    if length == 1:
        return "isolated"
    if index == 0:
        return "initial"
    if index == length - 1:
        return "final"
    return "medial"


def token_records(
    word_id: str,
    letters: list[str],
    spans: list[tuple[str, float, float]],
) -> list[dict]:
    if len(letters) != len(spans):
        raise ValueError(
            f"{word_id}: {len(letters)} letters but {len(spans)} aligned spans"
        )

    records = []
    for index, (letter, (_, start, end)) in enumerate(zip(letters, spans)):
        records.append({
            "letter": letter,
            "position": position_at(index, len(letters)),
            "previousLetter": letters[index - 1] if index > 0 else None,
            "nextLetter": letters[index + 1] if index < len(letters) - 1 else None,
            "sourceWord": "".join(letters),
            "indexInWord": index,
            "groupLength": len(letters),
            "startSeconds": start,
            "endSeconds": end,
        })
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=pathlib.Path)
    args = parser.parse_args()

    words = json.loads((args.session / "words.json").read_text(encoding="utf-8"))
    tokens_dir = args.session / "tokens"
    tokens_dir.mkdir(exist_ok=True)

    partial = []
    for entry in words:
        word_id = pathlib.Path(entry["file"]).stem
        grid_path = args.session / "aligned" / f"{word_id}.TextGrid"
        if not grid_path.exists():
            print(f"{word_id}: no TextGrid — alignment failed, skipping")
            continue

        audio, rate = soundfile.read(args.session / entry["file"], dtype="float32")
        spans = spans_from_textgrid(grid_path)
        # Already parsed by the json.loads above — words.json stores letters as
        # an array, not as an embedded JSON string.
        letters = entry.get("letters")
        if not letters:
            raise SystemExit(
                f"{word_id}: words.json has no letters array; re-record or add one"
            )

        for record in token_records(word_id, letters, spans):
            start = max(0, int((record["startSeconds"] - MARGIN_SECONDS) * rate))
            end = min(len(audio), int((record["endSeconds"] + MARGIN_SECONDS) * rate))
            name = f"{word_id}-{record['indexInWord']}.wav"
            soundfile.write(tokens_dir / name, audio[start:end], rate, subtype="PCM_24")
            record["path"] = f"tokens/{name}"
            partial.append(record)

    (args.session / "tokens-partial.json").write_text(
        json.dumps(partial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"cut {len(partial)} tokens into {tokens_dir}")


if __name__ == "__main__":
    main()
