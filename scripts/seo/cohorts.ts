import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import type { SeoMeasurementConfig } from "./config";
import { pathFromUrl } from "./core";

export interface SeoCohorts {
  treatmentPages: string[];
  controlCandidates: string[];
  inspectionSample: string[];
}

function canonicalUrl(origin: string, path: string): string {
  const url = new URL(path, origin);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString().replace(/\/$/, url.pathname === "/" ? "/" : "");
}

export function parseSitemapUrls(xml: string, origin: string): string[] {
  const document = new JSDOM(xml, { contentType: "text/xml" }).window.document;
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid sitemap XML: ${parserError.textContent?.trim()}`);
  }

  const expectedOrigin = new URL(origin).origin;
  const urls = [...document.querySelectorAll("url > loc")]
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .map((value) => new URL(value))
    .filter((url) => url.origin === expectedOrigin)
    .map((url) => canonicalUrl(origin, url.pathname));

  return [...new Set(urls)].sort();
}

function hasPrefix(url: string, prefixes: readonly string[]): boolean {
  const path = pathFromUrl(url);
  return path !== null && prefixes.some((prefix) => path.startsWith(prefix));
}

function stableSample(
  urls: readonly string[],
  seed: string,
  limit: number
): string[] {
  return [...urls]
    .sort((left, right) => {
      const leftHash = createHash("sha256")
        .update(`${seed}:${left}`)
        .digest("hex");
      const rightHash = createHash("sha256")
        .update(`${seed}:${right}`)
        .digest("hex");
      return leftHash.localeCompare(rightHash) || left.localeCompare(right);
    })
    .slice(0, limit);
}

export function buildSeoCohorts(
  config: SeoMeasurementConfig,
  sitemapUrls: readonly string[]
): SeoCohorts {
  const exactPages = config.treatment.exactPaths.map((path) =>
    canonicalUrl(config.site.origin, path)
  );
  const sitemapTreatment = sitemapUrls.filter((url) =>
    hasPrefix(url, config.treatment.sitemapPathPrefixes)
  );
  const treatmentPages = [
    ...new Set([...exactPages, ...sitemapTreatment]),
  ].sort();
  const treatmentSet = new Set(treatmentPages);
  const controlCandidates = sitemapUrls.filter(
    (url) =>
      !treatmentSet.has(url) &&
      hasPrefix(url, config.controls.candidatePathPrefixes)
  );
  const remainingSlots = Math.max(
    0,
    config.treatment.inspectionSampleLimit - exactPages.length
  );
  const sampledDynamic = stableSample(
    sitemapTreatment.filter((url) => !exactPages.includes(url)),
    config.experimentId,
    remainingSlots
  );

  return {
    treatmentPages,
    controlCandidates,
    inspectionSample: [...new Set([...exactPages, ...sampledDynamic])],
  };
}

export async function fetchSeoCohorts(
  config: SeoMeasurementConfig
): Promise<SeoCohorts> {
  const sitemapUrl = new URL("/sitemap.xml", config.site.origin);
  const response = await fetch(sitemapUrl, {
    headers: { "user-agent": "FlowArtsComposerSeoMeasurement/1.0" },
  });
  if (!response.ok) {
    throw new Error(
      `Sitemap request failed with HTTP ${response.status} at ${sitemapUrl}`
    );
  }

  return buildSeoCohorts(
    config,
    parseSitemapUrls(await response.text(), config.site.origin)
  );
}
