import { writeFileSync } from 'fs';
import { getStandaloneRenderer } from './src/core/standalone-renderer.js';

const pictograph = {
  letter: 'A',
  startPosition: 'alpha5',
  endPosition: 'alpha7',
  blueMotion: {
    motionType: 'pro',
    rotationDirection: 'cw',
    startLocation: 'n',
    endLocation: 'e',
    startOrientation: 'in',
    color: 'blue' as const,
    turns: 1,
  },
  redMotion: {
    motionType: 'pro',
    rotationDirection: 'cw',
    startLocation: 's',
    endLocation: 'w',
    startOrientation: 'in',
    color: 'red' as const,
    turns: 3,
  },
};

async function main() {
  console.log('Rendering A from alpha5, blue=1 turn, red=3 turns...');
  const renderer = getStandaloneRenderer();
  const png = await renderer.renderToPng(pictograph, {
    darkMode: true,
    showTKA: true,
    showVTG: true,
    showElemental: true,
    showPositions: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    size: 600,
  });

  writeFileSync('C:/Users/Austen/Desktop/A-alpha5-1-3.png', png);
  console.log('Saved to C:/Users/Austen/Desktop/A-alpha5-1-3.png');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
