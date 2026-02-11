"""
Flow Arts Transcription Pipeline - Whisper Transcriber

Usage:
    python transcribe.py <audio_file>              # Transcribe single file to stdout (SRT format)
    python transcribe.py <audio_file> -o out.srt   # Transcribe to file
    python transcribe.py --batch <directory>        # Batch transcribe all MP3s in directory

Uses faster-whisper with large-v3 model, int8 quantization.
Runs at roughly real-time on CPU (1 hour audio ~ 1 hour processing).
"""

import argparse
import os
import sys
from pathlib import Path


def format_timestamp(seconds: float) -> str:
    """Format seconds as SRT timestamp: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", ",")


def transcribe_file(model, audio_path: str, output_path: str | None = None):
    """Transcribe a single audio file to SRT format."""
    print(f"Transcribing: {audio_path}", file=sys.stderr)

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language="en",
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
    )

    print(
        f"Detected language: {info.language} (probability: {info.language_probability:.2f})",
        file=sys.stderr,
    )
    print(
        f"Duration: {info.duration:.1f}s ({info.duration / 60:.1f} min)", file=sys.stderr
    )

    out = open(output_path, "w", encoding="utf-8") if output_path else sys.stdout

    try:
        for i, segment in enumerate(segments, 1):
            start_ts = format_timestamp(segment.start)
            end_ts = format_timestamp(segment.end)
            out.write(f"{i}\n")
            out.write(f"{start_ts} --> {end_ts}\n")
            out.write(f"{segment.text.strip()}\n")
            out.write("\n")

            if i % 50 == 0:
                print(f"  ...processed {i} segments ({segment.end:.0f}s)", file=sys.stderr)
    finally:
        if output_path:
            out.close()

    print(f"Done: {i} segments written.", file=sys.stderr)


def batch_transcribe(model, directory: str, output_dir: str | None = None):
    """Transcribe all MP3 files in a directory."""
    audio_dir = Path(directory)
    mp3_files = sorted(audio_dir.glob("**/*.mp3"))

    if not mp3_files:
        print(f"No MP3 files found in {directory}", file=sys.stderr)
        return

    print(f"Found {len(mp3_files)} MP3 files to transcribe.", file=sys.stderr)

    for mp3 in mp3_files:
        relative = mp3.relative_to(audio_dir)
        if output_dir:
            out_path = Path(output_dir) / relative.with_suffix(".srt")
        else:
            out_path = mp3.with_suffix(".srt")

        out_path.parent.mkdir(parents=True, exist_ok=True)

        if out_path.exists():
            print(f"Skipping (already exists): {out_path}", file=sys.stderr)
            continue

        transcribe_file(model, str(mp3), str(out_path))


def main():
    parser = argparse.ArgumentParser(description="Transcribe flow arts audio with faster-whisper")
    parser.add_argument("input", nargs="?", help="Audio file or directory to transcribe")
    parser.add_argument("-o", "--output", help="Output SRT file path")
    parser.add_argument("--batch", action="store_true", help="Batch transcribe directory")
    parser.add_argument(
        "--model",
        default="large-v3",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper model size (default: large-v3)",
    )
    parser.add_argument(
        "--output-dir",
        help="Output directory for batch mode (default: alongside audio files)",
    )

    args = parser.parse_args()

    if not args.input:
        parser.print_help()
        sys.exit(1)

    from faster_whisper import WhisperModel

    print(f"Loading {args.model} model (int8, CPU)...", file=sys.stderr)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print("Model loaded.", file=sys.stderr)

    if args.batch:
        batch_transcribe(model, args.input, args.output_dir)
    else:
        transcribe_file(model, args.input, args.output)


if __name__ == "__main__":
    main()
