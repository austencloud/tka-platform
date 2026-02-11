#!/bin/bash
# Download audio for Whisper re-transcription (priority channels only)
# Usage: bash download-audio.sh [channel_name]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIO_DIR="$SCRIPT_DIR/audio"
ARCHIVE="$SCRIPT_DIR/audio-done.txt"

declare -A CHANNELS=(
    ["DrexFactor"]="https://www.youtube.com/channel/UCLdxKhzTFBH85cjiSfMVeFQ"
    ["NoelYee"]="https://www.youtube.com/channel/UCxNTT-bLX8l61ozRcrs41VQ"
    ["SpinMorePoi"]="https://www.youtube.com/channel/UCQhs6eDAxNCr-1ZjCzdtFOA"
    ["PlayPoi"]="https://www.youtube.com/channel/UC1JgoAfZwzwO7himGUiYPlQ"
    ["CharlieCushing"]="https://www.youtube.com/channel/UCmFwmuAGmvswnZuIUlY721w"
    ["SkylarGarard"]="https://www.youtube.com/channel/UCbLHNRSASZS_gwkmRATH1-A"
)

download_audio() {
    local name="$1"
    local url="$2"
    local out_dir="$AUDIO_DIR/$name"

    mkdir -p "$out_dir"

    echo "=========================================="
    echo "Downloading audio: $name"
    echo "=========================================="

    yt-dlp \
        -x --audio-format mp3 --audio-quality 3 \
        --download-archive "$ARCHIVE" \
        --embed-metadata \
        --no-overwrites \
        --ignore-errors \
        --sleep-interval 2 \
        --max-sleep-interval 5 \
        -o "$out_dir/%(title).100s [%(id)s].%(ext)s" \
        "$url/videos"

    echo "Done: $name ($(ls "$out_dir"/*.mp3 2>/dev/null | wc -l) MP3 files)"
}

if [ -n "$1" ]; then
    if [ -n "${CHANNELS[$1]}" ]; then
        download_audio "$1" "${CHANNELS[$1]}"
    else
        echo "Unknown channel: $1"
        echo "Available: ${!CHANNELS[*]}"
        exit 1
    fi
else
    # Priority 1 channels only for audio (Whisper path)
    for name in DrexFactor NoelYee SpinMorePoi; do
        download_audio "$name" "${CHANNELS[$name]}"
    done
fi
