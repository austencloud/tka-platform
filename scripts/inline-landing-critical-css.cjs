const fs = require("node:fs");
const path = require("node:path");
const { transform: transformCss } = require("lightningcss");

const STYLESHEET_TAG = /<link\b[^>]*\brel="stylesheet"[^>]*>/gi;
const MODULE_PRELOAD_TAG =
  /<link\b(?=[^>]*\brel="modulepreload")(?=[^>]*\bhref="([^"]+)")[^>]*>/gi;
const APP_STYLE_PREFIX = "/_app/immutable/assets/";

function isFirstScreenStyle(assetName, css) {
  return (
    assetName.startsWith("0.") ||
    assetName.startsWith("SiteFooter.") ||
    assetName.startsWith("SequenceHeroDemo.") ||
    assetName.startsWith("Crossfade.") ||
    css.includes(".home-hero.svelte-")
  );
}

function splitSiteChromeCss(assetName, css) {
  if (!assetName.startsWith("SiteFooter.")) {
    return { criticalCss: css, deferFullAsset: false };
  }

  const footerHash = css.match(/\.site-footer\.svelte-([a-z0-9]+)/)?.[1];
  if (!footerHash) {
    throw new Error(`Site footer ownership marker missing from ${assetName}`);
  }

  const footerScope = `svelte-${footerHash}`;
  const transformed = transformCss({
    filename: assetName,
    code: Buffer.from(css),
    minify: true,
    visitor: {
      Rule: {
        style(rule) {
          if (JSON.stringify(rule.value.selectors).includes(footerScope)) {
            return [];
          }
        },
        keyframes(rule) {
          if (JSON.stringify(rule.value.name).includes(footerScope)) {
            return [];
          }
        },
      },
    },
  });

  return {
    criticalCss: transformed.code.toString(),
    deferFullAsset: true,
  };
}

function inlineLandingStyles(html, readCss) {
  let count = 0;
  let deferredCount = 0;
  const transformed = html.replace(STYLESHEET_TAG, (tag) => {
    const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
    if (!href?.startsWith(APP_STYLE_PREFIX)) return tag;

    const css = readCss(href).replace(/<\/style/gi, "<\\/style");
    const assetName = path.posix.basename(href);

    if (!isFirstScreenStyle(assetName, css)) {
      deferredCount += 1;
      return [
        `<link rel="stylesheet" href="${href}" disabled data-tka-deferred-style>`,
        `<noscript>${tag}</noscript>`,
      ].join("");
    }

    const { criticalCss, deferFullAsset } = splitSiteChromeCss(assetName, css);
    count += 1;
    if (deferFullAsset) deferredCount += 1;
    return [
      `<style data-tka-critical="${assetName}">${criticalCss}</style>`,
      deferFullAsset
        ? `<link rel="stylesheet" href="${href}" disabled data-tka-deferred-style>`
        : `<link rel="stylesheet" href="${href}" disabled data-tka-inlined-style>`,
      deferFullAsset ? `<noscript>${tag}</noscript>` : "",
    ].join("");
  });

  if (deferredCount === 0) return { html: transformed, count, deferredCount };

  const releaseDeferredStyles = `<script data-tka-deferred-style-loader>(function(){function load(){document.querySelectorAll("link[data-tka-deferred-style]").forEach(function(link){link.disabled=false})}if(window.__tkaLandingConstrained){window.addEventListener("load",function(){requestAnimationFrame(load)},{once:true})}else{load()}})();</script>`;

  return {
    html: transformed.replace("</head>", `${releaseDeferredStyles}</head>`),
    count,
    deferredCount,
  };
}

function gateLandingModules(html) {
  const modulePreloads = [];
  const insertionMarker = "<!-- tka-module-gate-insertion -->";
  let inserted = false;
  const withoutPreloads = html.replace(
    MODULE_PRELOAD_TAG,
    (_tag, href) => {
      modulePreloads.push(href);
      if (inserted) return "";
      inserted = true;
      return insertionMarker;
    }
  );

  if (modulePreloads.length === 0) {
    throw new Error("No landing module preloads found");
  }

  const preloadBootstrap = `<script data-tka-module-gate>(function(){var hrefs=${JSON.stringify(modulePreloads)};var started=false;window.__tkaPreloadLandingModules=function(){if(started)return;started=true;hrefs.forEach(function(href){var link=document.createElement("link");link.rel="modulepreload";link.href=href;link.crossOrigin="";document.head.appendChild(link)})};if(!window.__tkaLandingConstrained)window.__tkaPreloadLandingModules()})();</script>`;
  const withPreloadBootstrap = withoutPreloads.replace(
    insertionMarker,
    preloadBootstrap
  );

  const hydrationStart = 'import("/_app/env.js").then';
  if (!withPreloadBootstrap.includes(hydrationStart)) {
    throw new Error("Landing hydration bootstrap was not found");
  }

  const gatedHydration = `(window.__tkaLandingConstrained?new Promise(function(resolve){function start(){requestAnimationFrame(function(){window.__tkaPreloadLandingModules();resolve()})}if(document.readyState==="complete"){start()}else{window.addEventListener("load",start,{once:true})}}):Promise.resolve()).then(function(){return import("/_app/env.js")}).then`;

  return {
    html: withPreloadBootstrap.replace(hydrationStart, gatedHydration),
    count: modulePreloads.length,
  };
}

function inlineFile(htmlPath, assetRoot) {
  if (!fs.existsSync(htmlPath)) return null;

  const source = fs.readFileSync(htmlPath, "utf8");
  const styled = inlineLandingStyles(source, (href) =>
    fs.readFileSync(path.join(assetRoot, href.slice(1)), "utf8")
  );
  const gated = gateLandingModules(styled.html);

  if (styled.count === 0) {
    throw new Error(`No landing stylesheets found in ${htmlPath}`);
  }

  fs.writeFileSync(htmlPath, gated.html);
  return {
    criticalStyles: styled.count,
    deferredStyles: styled.deferredCount,
    modulePreloads: gated.count,
  };
}

function main() {
  const workspace = path.resolve(__dirname, "..");
  const targets = [
    {
      html: path.join(
        workspace,
        ".svelte-kit/output/prerendered/pages/index.html"
      ),
      assets: path.join(workspace, ".svelte-kit/output/client"),
    },
    {
      html: path.join(workspace, ".svelte-kit/cloudflare/index.html"),
      assets: path.join(workspace, ".svelte-kit/cloudflare"),
    },
  ];

  const completed = targets
    .map(({ html, assets }) => inlineFile(html, assets))
    .filter((result) => result !== null);

  if (completed.length === 0) {
    throw new Error("Landing prerender output was not found");
  }

  console.log(
    `[landing-critical-css] ${completed
      .map(
        ({ criticalStyles, deferredStyles, modulePreloads }) =>
          `${criticalStyles} critical CSS, ${deferredStyles} deferred CSS, ${modulePreloads} gated modules`
      )
      .join(" / ")}`
  );
}

if (require.main === module) main();

module.exports = { gateLandingModules, inlineLandingStyles, splitSiteChromeCss };
