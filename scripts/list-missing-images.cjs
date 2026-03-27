const seeds = require('./festival-seed-data.cjs');
const missing = seeds.filter(s => !s.imageUrl);
const has = seeds.filter(s => !!s.imageUrl);
console.log('Has image:', has.length);
console.log('Missing image:', missing.length);
console.log();
missing.forEach(s => console.log('-', s.name, '|', s.websiteUrl || 'no url'));
