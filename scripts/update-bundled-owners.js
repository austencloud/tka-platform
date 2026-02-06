/**
 * Add owner data to bundled sequence-index.json
 */

import { readFileSync, writeFileSync } from "fs";
import config from "../config/feedback.config.js";

// Use admin user from config
const AUSTEN_USER = {
  ownerId: config.ADMIN_USER.userId,
  ownerDisplayName: config.ADMIN_USER.displayName,
  ownerAvatarUrl: config.ADMIN_USER.photoURL,
};

// Read the JSON file
const filePath = "./static/sequence-index.json";
const data = JSON.parse(readFileSync(filePath, "utf8"));

console.log(`\nUpdating ${data.totalSequences} sequences with owner data...\n`);

// Add owner fields to each sequence
let updated = 0;
for (const seq of data.sequences) {
  if (!seq.ownerId) {
    seq.ownerId = AUSTEN_USER.ownerId;
    seq.ownerDisplayName = AUSTEN_USER.ownerDisplayName;
    seq.ownerAvatarUrl = AUSTEN_USER.ownerAvatarUrl;
    updated++;
  }
}

// Write back
writeFileSync(filePath, JSON.stringify(data, null, 2));

console.log(`✅ Updated ${updated} sequences with owner data.`);
console.log(`   File: ${filePath}\n`);
