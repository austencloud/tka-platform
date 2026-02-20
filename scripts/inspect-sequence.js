#!/usr/bin/env node
/**
 * Inspect the full structure of a specific sequence document
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function inspect() {
  // Inspect one of Elizabeth's sequences
  const path = "users/WcrNzdjz7oahRtYNj7uKy80Xasn2/sequences/seq_1765578645612_oie0f18z2";
  const doc = await db.doc(path).get();

  if (!doc.exists) {
    console.log("Document not found at", path);
    return;
  }

  const data = doc.data();
  console.log("=== TOP-LEVEL KEYS ===");
  console.log(Object.keys(data));
  console.log("\n=== FULL DOCUMENT (truncated arrays) ===");

  // Print each top-level field, but truncate large arrays
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      console.log(`\n${key}: Array[${value.length}]`);
      if (value.length > 0) {
        console.log("  First item keys:", Object.keys(value[0] || {}));
        console.log("  First item:", JSON.stringify(value[0], null, 2).slice(0, 500));
      }
    } else if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value);
      console.log(`\n${key}: Object {${keys.join(", ")}}`);
      if (keys.length < 15) {
        console.log("  ", JSON.stringify(value, null, 2).slice(0, 800));
      }
    } else {
      console.log(`\n${key}: ${JSON.stringify(value)}`);
    }
  }
}

inspect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
