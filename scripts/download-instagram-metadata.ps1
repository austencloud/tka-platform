# Download Instagram metadata for all videos we have
# This fetches .json metadata files using shortcodes from our existing video filenames

$videoDir = "downloads\instagram\tkaflowarts"
$metadataDir = "downloads\instagram\metadata"

# Create metadata directory
New-Item -ItemType Directory -Force -Path $metadataDir | Out-Null

# Get all shortcodes from video filenames
$videos = Get-ChildItem "$videoDir\*.mp4"
$total = $videos.Count
$current = 0

Write-Host "Found $total videos to fetch metadata for"
Write-Host ""

foreach ($video in $videos) {
    $current++
    # Extract shortcode from filename like "2022-07-21_19-01-22__CgSQebjFdPT.mp4"
    if ($video.Name -match '__([A-Za-z0-9_-]+)\.mp4$') {
        $shortcode = $Matches[1]

        # Check if we already have metadata for this shortcode
        $existingJson = Get-ChildItem "$videoDir\*$shortcode*.json" -ErrorAction SilentlyContinue
        if ($existingJson) {
            Write-Host "[$current/$total] $shortcode - already have metadata, skipping"
            continue
        }

        Write-Host "[$current/$total] Fetching metadata for $shortcode..."

        # Download just the metadata using instaloader
        # The -- prefix tells instaloader this is a shortcode
        $result = & instaloader --no-videos --no-pictures --no-video-thumbnails --dirname-pattern="$metadataDir" -- "-$shortcode" 2>&1

        # Small delay to avoid rate limiting
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""
Write-Host "Done! Metadata files saved to $metadataDir"
