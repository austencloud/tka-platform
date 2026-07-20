#!/usr/bin/env node
import { JSDOM } from "jsdom";
import { parseSitemapUrls } from "./seo/cohorts";
import { loadSeoMeasurementConfig } from "./seo/config";

interface Finding {
  target: string;
  check: string;
  detail: string;
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString().replace(/\/$/, url.pathname === "/" ? "/" : "");
}

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function fetchText(
  url: URL,
  options: RequestInit = {}
): Promise<{ response: Response; text: string }> {
  const response = await fetch(url, {
    headers: { "user-agent": "FlowArtsComposerSeoVerifier/1.0" },
    ...options,
  });
  return { response, text: await response.text() };
}

function validateHtml(
  pageUrl: string,
  expectedCanonical: string,
  html: string
): Finding[] {
  const findings: Finding[] = [];
  const document = new JSDOM(html).window.document;
  const title = document.querySelector("title")?.textContent?.trim() ?? "";
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() ?? "";
  const canonical = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  const robots =
    document
      .querySelector('meta[name="robots"]')
      ?.getAttribute("content")
      ?.toLocaleLowerCase("en-US") ?? "";
  const requiredMeta = [
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:image"]',
    'meta[name="twitter:card"]',
  ];

  if (!document.documentElement.lang) {
    findings.push({ target: pageUrl, check: "html-lang", detail: "missing" });
  }
  if (!title) {
    findings.push({ target: pageUrl, check: "title", detail: "missing" });
  }
  if (!description) {
    findings.push({
      target: pageUrl,
      check: "meta-description",
      detail: "missing",
    });
  }
  if (
    !canonical ||
    normalizeUrl(canonical) !== normalizeUrl(expectedCanonical)
  ) {
    findings.push({
      target: pageUrl,
      check: "canonical",
      detail: canonical ?? "missing",
    });
  }
  if (robots.includes("noindex")) {
    findings.push({
      target: pageUrl,
      check: "robots-meta",
      detail: robots,
    });
  }
  for (const selector of requiredMeta) {
    if (!document.querySelector(selector)?.getAttribute("content")?.trim()) {
      findings.push({
        target: pageUrl,
        check: "social-meta",
        detail: `missing ${selector}`,
      });
    }
  }
  const headings = document.querySelectorAll("h1");
  if (headings.length !== 1) {
    findings.push({
      target: pageUrl,
      check: "h1-count",
      detail: String(headings.length),
    });
  }
  const jsonLd = [
    ...document.querySelectorAll('script[type="application/ld+json"]'),
  ];
  if (jsonLd.length === 0) {
    findings.push({ target: pageUrl, check: "json-ld", detail: "missing" });
  }
  for (const script of jsonLd) {
    try {
      JSON.parse(script.textContent ?? "");
    } catch {
      findings.push({
        target: pageUrl,
        check: "json-ld",
        detail: "invalid JSON",
      });
    }
  }

  return findings;
}

async function main(): Promise<void> {
  const config = loadSeoMeasurementConfig();
  const fetchOrigin = new URL(flagValue("--url") ?? config.site.origin);
  const canonicalOrigin = new URL(
    flagValue("--canonical-origin") ?? config.site.origin
  );
  const findings: Finding[] = [];
  const [robotsResult, sitemapResult, landingResult] = await Promise.all([
    fetchText(new URL("/robots.txt", fetchOrigin)),
    fetchText(new URL("/sitemap.xml", fetchOrigin)),
    fetchText(new URL("/landing", fetchOrigin), { redirect: "manual" }),
  ]);

  if (!robotsResult.response.ok) {
    findings.push({
      target: "/robots.txt",
      check: "http-status",
      detail: String(robotsResult.response.status),
    });
  }
  if (
    !robotsResult.text.includes(
      `Sitemap: ${canonicalOrigin.origin}/sitemap.xml`
    )
  ) {
    findings.push({
      target: "/robots.txt",
      check: "sitemap-directive",
      detail: "missing or wrong origin",
    });
  }
  if (robotsResult.text.includes("Disallow: /_app/")) {
    findings.push({
      target: "/robots.txt",
      check: "asset-crawl",
      detail: "/_app is blocked",
    });
  }
  if (!sitemapResult.response.ok) {
    findings.push({
      target: "/sitemap.xml",
      check: "http-status",
      detail: String(sitemapResult.response.status),
    });
  }

  const sitemapUrls = parseSitemapUrls(
    sitemapResult.text,
    canonicalOrigin.origin
  );
  const sitemapDocument = new JSDOM(sitemapResult.text, {
    contentType: "text/xml",
  }).window.document;
  const rawLocations = [...sitemapDocument.querySelectorAll("url > loc")].map(
    (node) => normalizeUrl(node.textContent?.trim() ?? "")
  );
  const duplicateCount = rawLocations.length - new Set(rawLocations).size;
  if (duplicateCount > 0) {
    findings.push({
      target: "/sitemap.xml",
      check: "duplicates",
      detail: String(duplicateCount),
    });
  }
  const foreignLocations = rawLocations.filter(
    (url) => new URL(url).origin !== canonicalOrigin.origin
  );
  if (foreignLocations.length > 0) {
    findings.push({
      target: "/sitemap.xml",
      check: "foreign-origin",
      detail: foreignLocations.join(", "),
    });
  }
  const requiredPaths = ["/", "/composer", "/roots/software", "/about", "/faq"];
  for (const path of requiredPaths) {
    const expected = normalizeUrl(new URL(path, canonicalOrigin).toString());
    if (!sitemapUrls.some((url) => normalizeUrl(url) === expected)) {
      findings.push({
        target: "/sitemap.xml",
        check: "required-url",
        detail: `missing ${path}`,
      });
    }
  }

  const landingLocation = landingResult.response.headers.get("location");
  if (
    landingResult.response.status !== 301 ||
    !landingLocation ||
    new URL(landingLocation, fetchOrigin).pathname !== "/"
  ) {
    findings.push({
      target: "/landing",
      check: "canonical-redirect",
      detail: `${landingResult.response.status} ${landingLocation ?? "no location"}`,
    });
  }

  const dynamicSample = sitemapUrls
    .filter((url) => new URL(url).pathname.startsWith("/sequence/"))
    .sort()
    .slice(0, 3);
  const pagesToCheck = [
    ...new Set([
      ...requiredPaths.map((path) => new URL(path, canonicalOrigin).toString()),
      ...dynamicSample,
    ]),
  ];
  const pageResults = await Promise.all(
    pagesToCheck.map(async (pageUrl) => ({
      pageUrl,
      ...(await fetchText(new URL(new URL(pageUrl).pathname, fetchOrigin))),
    }))
  );
  for (const result of pageResults) {
    if (result.response.status !== 200) {
      findings.push({
        target: result.pageUrl,
        check: "http-status",
        detail: String(result.response.status),
      });
      continue;
    }
    const contentType = result.response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      findings.push({
        target: result.pageUrl,
        check: "content-type",
        detail: contentType || "missing",
      });
      continue;
    }
    findings.push(...validateHtml(result.pageUrl, result.pageUrl, result.text));
  }

  if (findings.length > 0) {
    process.stderr.write(
      `${findings.length} SEO verification failure${findings.length === 1 ? "" : "s"}:\n`
    );
    for (const finding of findings) {
      process.stderr.write(
        `- ${finding.target} [${finding.check}] ${finding.detail}\n`
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `SEO verification passed for robots.txt, sitemap.xml, the landing redirect, and ${pagesToCheck.length} indexable pages at ${fetchOrigin.origin}.\n`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`SEO verification failed: ${message}\n`);
  process.exitCode = 1;
});
