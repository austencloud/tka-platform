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

function httpsPost(options, body) {
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

async function main() {
  // Get access token
  const tokenData = await httpsPost(
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

  console.log("Got access token");

  // Seed product
  const product = {
    fields: {
      name: { stringValue: "8-Count Quartered Rotated Loops" },
      description: {
        stringValue:
          "128 unique circular sequences organized by hand-path family. Each card shows a different quartered rotated LOOP pattern with full pictograph notation on the front and sequence details on the back. Level 1, diamond grid.",
      },
      type: { stringValue: "physical-deck" },
      price: { integerValue: "5000" },
      cardCount: { integerValue: "128" },
      deckId: { stringValue: "l1-quartered-strict-rotated-8beat" },
      stripePriceId: { stringValue: "price_placeholder" },
      status: { stringValue: "active" },
      previewImageUrls: { arrayValue: { values: [] } },
      coverImageUrl: { stringValue: "" },
      sortOrder: { integerValue: "1" },
    },
  };

  const result = await httpsPost(
    {
      hostname: "firestore.googleapis.com",
      path: "/v1/projects/the-kinetic-alphabet/databases/(default)/documents/products",
      method: "POST",
      headers: {
        Authorization: "Bearer " + tokenData.access_token,
        "Content-Type": "application/json",
      },
    },
    JSON.stringify(product)
  );

  if (result.name) {
    const docId = result.name.split("/").pop();
    console.log("Product seeded with ID:", docId);
  } else {
    console.error("Failed to seed:", JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
