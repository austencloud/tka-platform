"""Encode a native CDP screencast using its recorded frame timestamps."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("root", type=Path)
parser.add_argument("ids", nargs="*")
parser.add_argument("--ffmpeg", default="E:/_ARCHIVE/zoom-recorder/binaries/ffmpeg.exe")
args = parser.parse_args()
frames_root = args.root / "production" / "frames"
output = args.root / "raw-desktop"
output.mkdir(exist_ok=True)
for folder in sorted(frames_root.iterdir()):
    if args.ids and folder.name not in args.ids:
        continue
    proof = json.loads((folder / "capture.json").read_text(encoding="utf-8"))
    if proof.get("failure"):
        raise RuntimeError(f"Rejected capture {folder.name}: {proof['failure']}")
    frames = proof["frames"]
    if len(frames) < 2:
        raise RuntimeError(f"Insufficient frames for {folder.name}")
    lines = ["ffconcat version 1.0"]
    gaps = []
    for index, frame in enumerate(frames):
        gap = (frames[index + 1]["timestamp"] - frame["timestamp"]) if index + 1 < len(frames) else 1 / 30
        if gap <= 0:
            raise RuntimeError("Non-monotonic capture timestamp")
        gaps.append(gap)
        lines.extend([f"file '{frame['file']}'", "option framerate 1000", f"duration {gap:.9f}"])
    lines.append(f"file '{frames[-1]['file']}'")
    lines.append("option framerate 1000")
    timeline = folder / "timeline.ffconcat"
    timeline.write_text("\n".join(lines) + "\n", encoding="utf-8")
    subprocess.run([args.ffmpeg, "-y", "-v", "error", "-safe", "0", "-f", "concat", "-i", str(timeline),
                    "-vf", "fps=30,scale=1920:1080", "-c:v", "libx264", "-preset", "fast", "-crf", "16",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output / f"{folder.name}.mp4")], check=True)
    print(json.dumps({"id": folder.name, "frames": len(frames), "seconds": sum(gaps),
                      "sourceAverageFps": (len(frames)-1)/(frames[-1]["timestamp"]-frames[0]["timestamp"]),
                      "maxFrameGapSeconds": max(gaps), "outputFps": 30}), flush=True)
