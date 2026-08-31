const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function objectValue(value, path, errors) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return {};
  }
  return value;
}

function requiredString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function optionalString(value, path, errors) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    errors.push(`${path} must be a string when provided`);
    return "";
  }
  return value.trim();
}

function rejectUnknownKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not recognized`);
  }
}

function webUrl(value, path, errors) {
  const text = requiredString(value, path, errors);
  if (!text) return text;
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be a valid URL`);
  }
  return text;
}

function dateValue(value, path, errors) {
  const text = requiredString(value, path, errors);
  if (
    !DATE_PATTERN.test(text) ||
    Number.isNaN(Date.parse(`${text}T00:00:00Z`))
  ) {
    errors.push(`${path} must be an ISO date (YYYY-MM-DD)`);
  }
  return text;
}

function dateTimeValue(value, path, errors) {
  const text = requiredString(value, path, errors);
  if (!DATE_TIME_PATTERN.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push(`${path} must be an ISO date-time`);
  }
  return text;
}

export function validateCharacterProvenance(value) {
  const errors = [];
  const root = objectValue(value, "provenance", errors);
  const source = objectValue(root.source, "source", errors);
  const license = objectValue(root.license, "license", errors);
  const rights = objectValue(root.rights, "rights", errors);

  rejectUnknownKeys(
    root,
    [
      "schemaVersion",
      "id",
      "displayName",
      "description",
      "source",
      "license",
      "rights",
      "evidence",
      "acquiredAt",
    ],
    "provenance",
    errors
  );
  rejectUnknownKeys(
    source,
    ["provider", "assetName", "assetId", "creator", "url"],
    "source",
    errors
  );
  rejectUnknownKeys(license, ["name", "spdx", "url"], "license", errors);
  rejectUnknownKeys(
    rights,
    [
      "commercialUse",
      "applicationRuntimeDistribution",
      "rawSourceRedistribution",
      "attributionRequired",
      "creditLine",
      "restrictions",
    ],
    "rights",
    errors
  );

  if (root.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  const id = requiredString(root.id, "id", errors);
  if (id && !ID_PATTERN.test(id)) {
    errors.push("id must be lowercase kebab-case");
  }

  const displayName = requiredString(root.displayName, "displayName", errors);
  const description = optionalString(root.description, "description", errors);
  const provider = requiredString(source.provider, "source.provider", errors);
  const assetName = requiredString(
    source.assetName,
    "source.assetName",
    errors
  );
  const assetId = optionalString(source.assetId, "source.assetId", errors);
  const creator = optionalString(source.creator, "source.creator", errors);
  const sourceUrl = webUrl(source.url, "source.url", errors);
  const licenseName = requiredString(license.name, "license.name", errors);
  const spdx = optionalString(license.spdx, "license.spdx", errors);
  const licenseUrl = webUrl(license.url, "license.url", errors);

  if (rights.commercialUse !== "allowed") {
    errors.push("rights.commercialUse must be allowed before intake");
  }
  if (rights.applicationRuntimeDistribution !== "allowed") {
    errors.push(
      "rights.applicationRuntimeDistribution must be allowed before intake"
    );
  }
  if (
    !["allowed", "forbidden", "unknown", "not-addressed"].includes(
      rights.rawSourceRedistribution
    )
  ) {
    errors.push("rights.rawSourceRedistribution has an invalid value");
  }
  if (typeof rights.attributionRequired !== "boolean") {
    errors.push("rights.attributionRequired must be a boolean");
  }
  const creditLine = optionalString(
    rights.creditLine,
    "rights.creditLine",
    errors
  );
  if (rights.attributionRequired === true && creditLine === "") {
    errors.push("rights.creditLine is required when attribution is required");
  }
  if (
    rights.restrictions !== undefined &&
    !Array.isArray(rights.restrictions)
  ) {
    errors.push("rights.restrictions must be an array when provided");
  }
  const restrictions = Array.isArray(rights.restrictions)
    ? rights.restrictions.map((item, index) =>
        requiredString(item, `rights.restrictions[${index}]`, errors)
      )
    : [];

  const evidence = Array.isArray(root.evidence) ? root.evidence : [];
  if (evidence.length === 0) {
    errors.push("evidence must contain at least one record");
  }
  const normalizedEvidence = evidence.map((entry, index) => {
    const record = objectValue(entry, `evidence[${index}]`, errors);
    rejectUnknownKeys(
      record,
      ["url", "retrievedAt", "note"],
      `evidence[${index}]`,
      errors
    );
    return {
      url: webUrl(record.url, `evidence[${index}].url`, errors),
      retrievedAt: dateValue(
        record.retrievedAt,
        `evidence[${index}].retrievedAt`,
        errors
      ),
      note: requiredString(record.note, `evidence[${index}].note`, errors),
    };
  });
  const acquiredAt = dateTimeValue(root.acquiredAt, "acquiredAt", errors);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      id,
      displayName,
      description,
      source: { provider, assetName, assetId, creator, url: sourceUrl },
      license: { name: licenseName, spdx, url: licenseUrl },
      rights: {
        commercialUse: rights.commercialUse,
        applicationRuntimeDistribution: rights.applicationRuntimeDistribution,
        rawSourceRedistribution: rights.rawSourceRedistribution,
        attributionRequired: rights.attributionRequired,
        creditLine,
        restrictions,
      },
      evidence: normalizedEvidence,
      acquiredAt,
    },
  };
}
