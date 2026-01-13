#!/usr/bin/env node
/**
 * Get a pictograph image - visits the /render page which handles everything
 *
 * Usage: node scripts/get-pictograph.js A
 */

const letter = process.argv[2];

if (!letter) {
  console.log('Usage: node scripts/get-pictograph.js <letter>');
  console.log('Example: node scripts/get-pictograph.js A');
  console.log('\nThen visit: http://localhost:5173/render?letter=A');
  console.log('The pictograph will auto-download.');
  process.exit(0);
}

console.log(`\n📍 Visit this URL to download pictograph ${letter}:`);
console.log(`   http://localhost:5173/render?letter=${letter}`);
console.log(`\nThe pictograph will render and auto-download as pictograph-${letter}.png\n`);
