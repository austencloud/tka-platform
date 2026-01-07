#!/usr/bin/env python3
"""
Extract date_added and sequence metadata from legacy PNG files.
Outputs JSON file for use by birthday migration script.

Usage:
    python scripts/extract-legacy-dates.py
    python scripts/extract-legacy-dates.py --output custom-output.json
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
except ImportError:
    print("Error: PIL/Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

# Configuration
LEGACY_DICT_PATH = Path(r"F:\_THE KINETIC ALPHABET\_ARCHIVE\_LEGACY_DESKTOP_APP\data\dictionary")
OUTPUT_PATH = Path(__file__).parent / "legacy-sequence-dates.json"

def extract_png_metadata(png_path: Path) -> dict | None:
    """Extract metadata from a legacy PNG file."""
    try:
        img = Image.open(png_path)
        if 'metadata' not in img.info:
            return None

        data = json.loads(img.info['metadata'])
        return data
    except Exception as e:
        print(f"  Warning: Failed to read {png_path.name}: {e}")
        return None


def normalize_beat_for_comparison(beat: dict) -> dict:
    """
    Normalize a legacy beat to a comparable format.
    Extracts only the core motion attributes needed for comparison.
    """
    if beat.get('beat') == 0:
        # Start position
        return {
            'beat': 0,
            'letter': beat.get('letter'),
            'blue': {
                'start_loc': beat.get('blue_attributes', {}).get('start_loc'),
                'end_loc': beat.get('blue_attributes', {}).get('end_loc'),
                'motion_type': beat.get('blue_attributes', {}).get('motion_type'),
                'prop_rot_dir': beat.get('blue_attributes', {}).get('prop_rot_dir'),
                'turns': beat.get('blue_attributes', {}).get('turns'),
            },
            'red': {
                'start_loc': beat.get('red_attributes', {}).get('start_loc'),
                'end_loc': beat.get('red_attributes', {}).get('end_loc'),
                'motion_type': beat.get('red_attributes', {}).get('motion_type'),
                'prop_rot_dir': beat.get('red_attributes', {}).get('prop_rot_dir'),
                'turns': beat.get('red_attributes', {}).get('turns'),
            }
        }
    else:
        # Regular beat
        return {
            'beat': beat.get('beat'),
            'letter': beat.get('letter'),
            'start_pos': beat.get('start_pos'),
            'end_pos': beat.get('end_pos'),
            'blue': {
                'start_loc': beat.get('blue_attributes', {}).get('start_loc'),
                'end_loc': beat.get('blue_attributes', {}).get('end_loc'),
                'motion_type': beat.get('blue_attributes', {}).get('motion_type'),
                'prop_rot_dir': beat.get('blue_attributes', {}).get('prop_rot_dir'),
                'turns': beat.get('blue_attributes', {}).get('turns'),
            },
            'red': {
                'start_loc': beat.get('red_attributes', {}).get('start_loc'),
                'end_loc': beat.get('red_attributes', {}).get('end_loc'),
                'motion_type': beat.get('red_attributes', {}).get('motion_type'),
                'prop_rot_dir': beat.get('red_attributes', {}).get('prop_rot_dir'),
                'turns': beat.get('red_attributes', {}).get('turns'),
            }
        }


def extract_all_sequences():
    """Extract all sequence data from legacy dictionary."""
    if not LEGACY_DICT_PATH.exists():
        print(f"Error: Legacy dictionary not found at {LEGACY_DICT_PATH}")
        sys.exit(1)

    sequences = []
    word_folders = [d for d in LEGACY_DICT_PATH.iterdir() if d.is_dir()]

    print(f"Scanning {len(word_folders)} word folders...")

    for folder in sorted(word_folders):
        png_files = list(folder.glob("*.png"))

        for png_file in png_files:
            metadata = extract_png_metadata(png_file)
            if not metadata:
                continue

            seq_data = metadata.get('sequence', [])
            if not seq_data:
                continue

            # First element is metadata, rest are beats
            header = seq_data[0] if seq_data else {}
            beats_raw = seq_data[1:] if len(seq_data) > 1 else []

            # Normalize beats for comparison
            beats_normalized = [normalize_beat_for_comparison(b) for b in beats_raw]

            sequence_info = {
                'file': str(png_file),
                'filename': png_file.name,
                'word': header.get('word', folder.name),
                'date_added': metadata.get('date_added'),
                'author': header.get('author'),
                'grid_mode': header.get('grid_mode'),
                'is_circular': header.get('is_circular', False),
                'prop_type': header.get('prop_type'),
                'beat_count': len(beats_raw),
                'beats_normalized': beats_normalized,
                # Include raw beats for detailed comparison if needed
                'beats_raw': beats_raw,
            }

            sequences.append(sequence_info)

    return sequences


def main():
    output_path = OUTPUT_PATH

    # Check for custom output path
    if '--output' in sys.argv:
        idx = sys.argv.index('--output')
        if idx + 1 < len(sys.argv):
            output_path = Path(sys.argv[idx + 1])

    print("=" * 60)
    print("  Legacy Sequence Date Extractor")
    print("=" * 60)
    print(f"\nSource: {LEGACY_DICT_PATH}")
    print(f"Output: {output_path}\n")

    sequences = extract_all_sequences()

    # Build summary
    with_dates = sum(1 for s in sequences if s.get('date_added'))
    without_dates = sum(1 for s in sequences if not s.get('date_added'))
    unique_words = len(set(s['word'] for s in sequences))

    # Find date range
    dates = [s['date_added'] for s in sequences if s.get('date_added')]
    if dates:
        dates_parsed = sorted([datetime.fromisoformat(d) for d in dates])
        oldest = dates_parsed[0].strftime('%Y-%m-%d')
        newest = dates_parsed[-1].strftime('%Y-%m-%d')
    else:
        oldest = newest = 'N/A'

    output_data = {
        'extracted_at': datetime.now().isoformat(),
        'source_path': str(LEGACY_DICT_PATH),
        'summary': {
            'total_sequences': len(sequences),
            'with_date_added': with_dates,
            'without_date_added': without_dates,
            'unique_words': unique_words,
            'oldest_date': oldest,
            'newest_date': newest,
        },
        'sequences': sequences
    }

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print("Summary:")
    print(f"  Total sequences: {len(sequences)}")
    print(f"  With date_added: {with_dates}")
    print(f"  Without date_added: {without_dates}")
    print(f"  Unique words: {unique_words}")
    print(f"  Date range: {oldest} to {newest}")
    print(f"\nOutput written to: {output_path}")


if __name__ == '__main__':
    main()
