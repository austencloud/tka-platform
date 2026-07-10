// Seeds the single purchasable LOOP Deck SKU (listing "loop-deck-custom",
// flat $30) for configurator v2. The 7 per-flavor SKUs stay as cover/flavor
// data sources; this is the only LOOP product buyers check out with.
// Idempotent: refuses to seed twice.
const fs = require("fs");
const https = require("https");
const path = require("path");
const os = require("os");

const configPath = path.join(
  os.homedir(),
  ".config",
  "configstore",
  "firebase-tools.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const FIRESTORE_BASE =
  "/v1/projects/the-kinetic-alphabet/databases/(default)/documents";

async function main() {
  const tokenData = await httpsRequest(
    {
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.tokens.refresh_token,
      client_id:
        "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
    }).toString()
  );
  if (!tokenData.access_token) {
    console.error("Failed to get access token:", tokenData);
    process.exit(1);
  }
  const auth = { Authorization: "Bearer " + tokenData.access_token };

  const existing = await httpsRequest(
    {
      hostname: "firestore.googleapis.com",
      path: `${FIRESTORE_BASE}:runQuery`,
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
    },
    JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "products" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "listing" },
            op: "EQUAL",
            value: { stringValue: "loop-deck-custom" },
          },
        },
        limit: 1,
      },
    })
  );
  if (Array.isArray(existing) && existing.some((r) => r.document)) {
    console.log(
      "loop-deck-custom already exists:",
      existing.find((r) => r.document).document.name.split("/").pop()
    );
    return;
  }

  const product = {
    fields: {
      name: { stringValue: "LOOP Deck" },
      description: {
        stringValue:
          "54 looping sequences built to your dials: pick a level, a length, and a flavor, or let the Variety Pack blend them. Every sequence ends exactly where it began.",
      },
      type: { stringValue: "physical-deck" },
      listing: { stringValue: "loop-deck-custom" },
      price: { integerValue: "3000" },
      cardCount: { integerValue: "54" },
      stripePriceId: { stringValue: "" },
      status: { stringValue: "active" },
      previewImageUrls: { arrayValue: { values: [] } },
      coverImageUrl: { stringValue: "" },
      preorder: { booleanValue: true },
      sortOrder: { integerValue: "1" },
    },
  };

  const result = await httpsRequest(
    {
      hostname: "firestore.googleapis.com",
      path: `${FIRESTORE_BASE}/products`,
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
    },
    JSON.stringify(product)
  );

  if (result.name) {
    console.log("loop-deck-custom seeded:", result.name.split("/").pop());
  } else {
    console.error("Failed to seed:", JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
