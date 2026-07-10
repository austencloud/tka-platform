// Seeds the Starter Pack bundle listing (draft) into Firestore `products`.
// Uses the firebase-tools refresh token, same as seed-store-product.cjs.
// Idempotence: refuses to seed if a listing === "starter-pack" doc exists.
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
const refreshToken = config.tokens.refresh_token;

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
      refresh_token: refreshToken,
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

  // Guard: already seeded?
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
            value: { stringValue: "starter-pack" },
          },
        },
        limit: 1,
      },
    })
  );
  if (Array.isArray(existing) && existing.some((r) => r.document)) {
    console.log(
      "starter-pack listing already exists:",
      existing.find((r) => r.document).document.name.split("/").pop()
    );
    return;
  }

  const boxContents = [
    "Timing & Direction trilogy — all 3 volumes",
    "Curated 54-card mixed LOOP deck, exclusive to the pack",
    "The Kinetic Alphabet book",
    "Foldable deck box for every deck",
    "Waterproof sleeved card holder with lanyard",
    "Free laminated quick-reference sheet",
  ];

  const product = {
    fields: {
      name: { stringValue: "The Starter Pack" },
      description: {
        stringValue:
          "Everything you need to start, in one box: the full teaching trilogy, a mixed LOOP deck sampling every flavor, the book that explains the system, and a waterproof holder to take your practice cards anywhere.",
      },
      type: { stringValue: "sampler-pack" },
      listing: { stringValue: "starter-pack" },
      price: { integerValue: "6500" },
      stripePriceId: { stringValue: "" },
      status: { stringValue: "draft" },
      previewImageUrls: { arrayValue: { values: [] } },
      coverImageUrl: { stringValue: "" },
      preorder: { booleanValue: true },
      sortOrder: { integerValue: "0" },
      boxContents: {
        arrayValue: {
          values: boxContents.map((s) => ({ stringValue: s })),
        },
      },
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
    console.log("Starter pack seeded (draft):", result.name.split("/").pop());
  } else {
    console.error("Failed to seed:", JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
