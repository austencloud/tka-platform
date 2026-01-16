import { writeFileSync } from 'fs';
import { exec } from 'child_process';
import { getStandaloneRenderer } from './src/core/standalone-renderer.js';

const letter = process.argv[2] || 'A';

// Sample pictographs for testing
const samples: Record<string, any> = {
  'A': {
    letter: 'A',
    startPosition: 'alpha3',
    endPosition: 'alpha5',
    blueMotion: {
      motionType: 'pro',
      rotationDirection: 'cw',
      startLocation: 'w',
      endLocation: 'n',
      startOrientation: 'in',
      color: 'blue',
      turns: 0,
    },
    redMotion: {
      motionType: 'pro',
      rotationDirection: 'cw',
      startLocation: 'e',
      endLocation: 's',
      startOrientation: 'in',
      color: 'red',
      turns: 0,
    },
  },
  'W-': {
    letter: 'W-',
    startPosition: 'gamma11',
    endPosition: 'alpha5',
    blueMotion: {
      motionType: 'dash',
      rotationDirection: 'no_rot',
      startLocation: 's',
      endLocation: 'n',
      startOrientation: 'in',
      color: 'blue',
      turns: 0,
    },
    redMotion: {
      motionType: 'pro',
      rotationDirection: 'cw',
      startLocation: 'e',
      endLocation: 's',
      startOrientation: 'in',
      color: 'red',
      turns: 0,
    },
  },
  'Λ-': {
    letter: 'Λ-',
    startPosition: 'alpha1',
    endPosition: 'gamma9',
    blueMotion: {
      motionType: 'dash',
      rotationDirection: 'no_rot',
      startLocation: 'n',
      endLocation: 's',
      startOrientation: 'in',
      color: 'blue',
      turns: 0,
    },
    redMotion: {
      motionType: 'pro',
      rotationDirection: 'cw',
      startLocation: 'e',
      endLocation: 's',
      startOrientation: 'in',
      color: 'red',
      turns: 0,
    },
  },
};

const pictograph = samples[letter];
if (!pictograph) {
  console.error(`Unknown letter: ${letter}. Available: ${Object.keys(samples).join(', ')}`);
  process.exit(1);
}

async function main() {
  console.log(`Generating ${letter}...`);

  const renderer = getStandaloneRenderer();
  const png = await renderer.renderToPng(pictograph, {
    darkMode: true,
    showTKA: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 600,
  });

  const filePath = `C:/Users/Austen/Desktop/${letter.replace('-', '_dash')}.png`;
  writeFileSync(filePath, png);
  console.log(`Saved to ${filePath}`);

  // Open with default viewer
  exec(`start "" "${filePath}"`, { shell: 'cmd.exe' }, (err) => {
    if (err) {
      console.error('Failed to open:', err.message);
    } else {
      console.log('Opened in viewer');
    }
  });
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
