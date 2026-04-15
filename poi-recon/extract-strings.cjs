#!/usr/bin/env node
// Extract printable ASCII and UTF-16LE strings from a binary.
// Usage: node extract-strings.cjs <file> [minLen]
const fs = require('fs');

const [, , filePath, minLenArg] = process.argv;
if (!filePath) {
  console.error('usage: node extract-strings.cjs <file> [minLen]');
  process.exit(1);
}
const minLen = parseInt(minLenArg ?? '6', 10);

const buf = fs.readFileSync(filePath);

// 1. ASCII strings: printable 0x20..0x7E, runs of >= minLen
const ascii = [];
{
  let start = -1;
  for (let i = 0; i <= buf.length; i++) {
    const b = i < buf.length ? buf[i] : 0;
    const printable = b >= 0x20 && b <= 0x7e;
    if (printable && start < 0) start = i;
    else if (!printable && start >= 0) {
      if (i - start >= minLen) {
        ascii.push(buf.toString('ascii', start, i));
      }
      start = -1;
    }
  }
}

// 2. UTF-16LE strings: printable ASCII in low byte, 0x00 in high byte
const utf16 = [];
{
  let start = -1;
  for (let i = 0; i <= buf.length - 2; i += 2) {
    const lo = buf[i];
    const hi = buf[i + 1];
    const printable = hi === 0 && lo >= 0x20 && lo <= 0x7e;
    if (printable && start < 0) start = i;
    else if (!printable && start >= 0) {
      const runLen = (i - start) / 2;
      if (runLen >= minLen) {
        let s = '';
        for (let j = start; j < i; j += 2) s += String.fromCharCode(buf[j]);
        utf16.push(s);
      }
      start = -1;
    }
  }
}

console.log(`# ASCII strings (${ascii.length}):`);
for (const s of ascii) console.log(s);
console.log(`\n# UTF-16 strings (${utf16.length}):`);
for (const s of utf16) console.log(s);
