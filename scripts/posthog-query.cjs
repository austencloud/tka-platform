#!/usr/bin/env node
/**
 * PostHog Query Runner with Templates
 *
 * Usage:
 *   node scripts/posthog-query.cjs overview
 *   node scripts/posthog-query.cjs visitors --host tkaflowarts.com --period 30d
 *   node scripts/posthog-query.cjs geo --host tkaflowarts.com
 *   node scripts/posthog-query.cjs "SELECT count() FROM events WHERE ..."
 *
 * Templates: overview, visitors, geo, sources, devices, pages, funnel, events, sessions
 * Flags: --host <domain>, --period <7d|30d|24h|today|month>
 */
const https = require("https");

const DEFAULT_API_HOST = "us.posthog.com";
const DEFAULT_PROJECT_ID = "299320";

// --- CLI Arg Parsing ---

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { command: null, host: null, period: "7d" };

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--host" && args[i + 1]) {
      result.host = args[i + 1];
      i += 2;
    } else if (args[i] === "--period" && args[i + 1]) {
      result.period = args[i + 1];
      i += 2;
    } else if (!result.command) {
      result.command = args[i];
      i++;
    } else {
      i++;
    }
  }

  return result;
}

// --- Period to HogQL date expression ---

function periodToDateExpr(period) {
  switch (period) {
    case "24h":
      return "now() - interval 24 hour";
    case "today":
      return "toStartOfDay(now())";
    case "7d":
      return "now() - interval 7 day";
    case "30d":
      return "now() - interval 30 day";
    case "month":
      return "toStartOfMonth(now())";
    default:
      // Try to parse as Nd format
      const match = period.match(/^(\d+)d$/);
      if (match) return `now() - interval ${match[1]} day`;
      return "now() - interval 7 day";
  }
}

// --- Host filter ---

function hostFilter(host) {
  if (!host) return "";
  return `AND properties.$host = '${host}'`;
}

// --- Query Templates ---

const templates = {
  overview: (dateExpr, hf) => `
    SELECT
      properties.$host AS host,
      count() AS pageviews,
      count(DISTINCT properties.$session_id) AS sessions,
      count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY host
    ORDER BY pageviews DESC
  `,

  visitors: (dateExpr, hf) => `
    SELECT
      toDate(timestamp) AS day,
      count(DISTINCT person_id) AS visitors,
      count(DISTINCT properties.$session_id) AS sessions,
      count() AS pageviews
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY day
    ORDER BY day DESC
  `,

  geo: (dateExpr, hf) => `
    SELECT
      properties.$geoip_country_name AS country,
      count(DISTINCT person_id) AS visitors,
      count() AS pageviews
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY country
    ORDER BY visitors DESC
    LIMIT 25
  `,

  sources: (dateExpr, hf) => `
    SELECT
      coalesce(
        nullIf(properties.$referring_domain, ''),
        nullIf(properties.utm_source, ''),
        '(direct)'
      ) AS source,
      properties.utm_medium AS medium,
      properties.utm_campaign AS campaign,
      count(DISTINCT person_id) AS visitors,
      count() AS pageviews
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY source, medium, campaign
    ORDER BY visitors DESC
    LIMIT 25
  `,

  devices: (dateExpr, hf) => `
    SELECT
      properties.$browser AS browser,
      properties.$os AS os,
      properties.$device_type AS device_type,
      count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY browser, os, device_type
    ORDER BY visitors DESC
    LIMIT 25
  `,

  pages: (dateExpr, hf) => `
    SELECT
      properties.$pathname AS path,
      count() AS pageviews,
      count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= ${dateExpr}
      ${hf}
    GROUP BY path
    ORDER BY pageviews DESC
    LIMIT 30
  `,

  funnel: (dateExpr, _hf, host) => `
    WITH organic_sessions AS (
      SELECT session_id AS sid
      FROM sessions
      WHERE "$start_timestamp" >= ${dateExpr}
        AND "$entry_hostname" = '${host || "tkaflowarts.com"}'
        AND "$entry_pathname" = '/composer'
        AND "$channel_type" = 'Organic Search'
    )
    SELECT
      count() AS organic_composer_sessions
    FROM organic_sessions
  `,

  events: (dateExpr, hf) => `
    SELECT
      event,
      count() AS occurrences,
      count(DISTINCT person_id) AS users
    FROM events
    WHERE timestamp >= ${dateExpr}
      AND event NOT LIKE '$%'
      ${hf}
    GROUP BY event
    ORDER BY occurrences DESC
    LIMIT 30
  `,

  sessions: (dateExpr, hf) => `
    SELECT
      round(avg(duration), 1) AS avg_duration_sec,
      round(median(duration), 1) AS median_duration_sec,
      round(min(duration), 1) AS min_duration_sec,
      round(max(duration), 1) AS max_duration_sec,
      count() AS total_sessions
    FROM (
      SELECT
        properties.$session_id AS sid,
        dateDiff('second', min(timestamp), max(timestamp)) AS duration
      FROM events
      WHERE timestamp >= ${dateExpr}
        ${hf}
      GROUP BY sid
      HAVING count() > 1
    )
  `,
};

// --- HTTP Request ---

function runQuery(hogql, options = {}) {
  const apiKey = options.apiKey || process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId =
    options.projectId || process.env.POSTHOG_PROJECT_ID || DEFAULT_PROJECT_ID;
  const apiHost =
    options.apiHost || process.env.POSTHOG_API_HOST || DEFAULT_API_HOST;

  if (!apiKey) {
    return Promise.reject(
      new Error("POSTHOG_PERSONAL_API_KEY not set in environment")
    );
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query: { kind: "HogQLQuery", query: hogql },
    });

    const options = {
      hostname: apiHost,
      path: `/api/projects/${projectId}/query/`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`PostHog error: ${parsed.error}`));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

// --- Output Formatting ---

function printResults(parsed) {
  const cols = parsed.columns || [];
  const rows = parsed.results || [];

  if (cols.length) console.log(cols.join("\t"));
  if (rows.length === 0) {
    console.log("(no results)");
    return;
  }
  for (const row of rows) {
    console.log(row.map((v) => (v === null ? "null" : v)).join("\t"));
  }
}

function printHelp() {
  console.log(`PostHog Query Runner

Templates:
  overview    Pageviews, sessions, visitors by host
  visitors    Daily visitor/session/pageview breakdown
  geo         Country breakdown
  sources     Referrer/UTM breakdown
  devices     Browser, OS, device type
  pages       Page path breakdown
  funnel      Landing → app conversion
  events      Top custom events (non-$ prefixed)
  sessions    Session duration stats

Flags:
  --host <domain>    Filter by hostname (e.g. tkaflowarts.com)
  --period <period>  Time range: 24h, today, 7d (default), 30d, month

Examples:
  node scripts/posthog-query.cjs overview
  node scripts/posthog-query.cjs visitors --period 30d
  node scripts/posthog-query.cjs geo --host tkaflowarts.com
  node scripts/posthog-query.cjs "SELECT count() FROM events"
`);
}

// --- Main ---

async function main() {
  const { command, host, period } = parseArgs(process.argv);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  const dateExpr = periodToDateExpr(period);
  const hf = hostFilter(host);

  let hogql;

  if (templates[command]) {
    hogql = templates[command](dateExpr, hf, host);
    console.log(
      `--- ${command} (period: ${period}${host ? `, host: ${host}` : ""}) ---\n`
    );
  } else if (command.toUpperCase().startsWith("SELECT")) {
    // Raw HogQL query
    hogql = command;
  } else {
    console.error(
      `Unknown template: "${command}". Run with "help" for available templates.`
    );
    process.exit(1);
  }

  try {
    const result = await runQuery(hogql);
    printResults(result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  hostFilter,
  parseArgs,
  periodToDateExpr,
  printResults,
  runQuery,
  templates,
};

if (require.main === module) {
  main();
}
