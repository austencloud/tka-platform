#!/bin/bash
# Download auto-generated subtitles for all flow arts channels
# Usage: bash download-subs.sh [channel_name]
# If no channel specified, downloads all.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRANSCRIPTS_DIR="$SCRIPT_DIR/transcripts"
ARCHIVE="$SCRIPT_DIR/subs-done.txt"

# Channel URLs (channel ID format for reliability)
declare -A CHANNELS=(
    ["DrexFactor"]="https://www.youtube.com/channel/UCLdxKhzTFBH85cjiSfMVeFQ"
    ["NoelYee"]="https://www.youtube.com/channel/UCxNTT-bLX8l61ozRcrs41VQ"
    ["SpinMorePoi"]="https://www.youtube.com/channel/UCQhs6eDAxNCr-1ZjCzdtFOA"
    ["PlayPoi"]="https://www.youtube.com/channel/UC1JgoAfZwzwO7himGUiYPlQ"
    ["CharlieCushing"]="https://www.youtube.com/channel/UCmFwmuAGmvswnZuIUlY721w"
    ["SkylarGarard"]="https://www.youtube.com/channel/UCbLHNRSASZS_gwkmRATH1-A"
)

download_channel() {
    local name="$1"
    local url="$2"
    local out_dir="$TRANSCRIPTS_DIR/$name"

    mkdir -p "$out_dir"

    echo "=========================================="
    echo "Downloading auto-subs: $name"
    echo "URL: $url"
    echo "Output: $out_dir"
    echo "=========================================="

    yt-dlp \
        --write-auto-subs \
        --sub-langs "en" \
        --convert-subs srt \
        --skip-download \
        --download-archive "$ARCHIVE" \
        --no-overwrites \
        --ignore-errors \
        --sleep-interval 1 \
        --max-sleep-interval 3 \
        -o "$out_dir/%(title).100s [%(id)s].%(ext)s" \
        "$url/videos"

    echo ""
    echo "Done: $name ($(ls "$out_dir"/*.srt 2>/dev/null | wc -l) SRT files)"
    echo ""
}

if [ -n "$1" ]; then
    # Download specific channel
    if [ -n "${CHANNELS[$1]}" ]; then
        download_channel "$1" "${CHANNELS[$1]}"
    else
        echo "Unknown channel: $1"
        echo "Available: ${!CHANNELS[*]}"
        exit 1
    fi
else
    # Download all channels
    for name in DrexFactor NoelYee SpinMorePoi CharlieCushing PlayPoi SkylarGarard; do
        download_channel "$name" "${CHANNELS[$name]}"
    done
fi

echo "=========================================="
echo "All downloads complete."
echo "Total SRT files: $(find "$TRANSCRIPTS_DIR" -name '*.srt' | wc -l)"
echo "=========================================="
