#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const EDITABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".svelte",
  ".css",
  ".scss",
  ".glsl",
  ".frag",
  ".vert",
  ".rs",
]);

const ROOTS = new Set([
  "cloudflare",
  "firebase-functions",
  "functions",
  "mcp-server",
  "mcp-server-pkg",
  "packages",
  "scripts",
  "src",
  "src-tauri",
  "tests",
  "tools",
]);

const ACTION_WORDS = new Set([
  "add",
  "apply",
  "build",
  "calculate",
  "call",
  "check",
  "clear",
  "compute",
  "convert",
  "create",
  "declare",
  "define",
  "delete",
  "export",
  "fetch",
  "filter",
  "get",
  "handle",
  "import",
  "initialize",
  "iterate",
  "load",
  "loop",
  "map",
  "parse",
  "register",
  "remove",
  "render",
  "reset",
  "return",
  "save",
  "set",
  "sort",
  "start",
  "stop",
  "unregister",
  "update",
  "use",
  "validate",
  "verify",
]);

const FILLER_WORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "at",
  "by",
  "current",
  "for",
  "from",
  "in",
  "into",
  "is",
  "new",
  "of",
  "on",
  "or",
  "specific",
  "the",
  "this",
  "to",
  "with",
]);

const PROTECTED_COMMENT =
  /(?:@license|copyright|SPDX|@preserve|@generated|auto-generated|generated file|do not edit|eslint|prettier|@ts-|tslint|svelte-ignore|istanbul|\bc8\b|coverage|stylelint|noinspection|sourceMappingURL|webpack|vite-ignore|#__PURE__|@__PURE__|@__NO_SIDE_EFFECTS__|\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b)/i;

const CONTEXT_MARKER =
  /(?:\b(?:active|after|appropriate|atomic|avoid|before|because|BPM|browser|cannot|can't|canonical|compatib|constraint|coordinate|debug|depends|doesn't|external|fails?|fallback|firebase|firestore|format|HMR|if|IndexedDB|invariant|instead|legacy|milliseconds?|must|network|only|otherwise|persist|pixels?|preserve|prevent|primary|progression|race|radians?|reason|screen|security|serializ|silently|so|source|SSR|units?|unless|until|user|visible|when|while|wire|without|workaround|world|would)\b|localStorage|sessionStorage)/i;

const DOMAIN_COMMENT =
  /\b(?:TKA|VTG|LOOP|pictographs?|letters?|positions?|orientations?|motions?|props?|arrows?|grid mode|turns?|dashes?|static|pro|anti|alpha|beta|gamma|theta|omega|hand paths?|reversals?|sequences?)\b/i;

const GENERATED_BANNER =
  /(?:@generated|auto-generated|generated file|this file is generated|do not edit)/i;

function splitIdentifier(value) {
  return value
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z\d]+/g) ?? [];
}

function stem(word) {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function meaningfulWords(value) {
  return splitIdentifier(value)
    .filter((word) => !FILLER_WORDS.has(word))
    .map(stem);
}

function literalSpans(source, jsx) {
  const scriptKind = jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    "comment-scan.ts",
    source,
    ts.ScriptTarget.Latest,
    false,
    scriptKind,
  );
  const spans = [];
  const literalKinds = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.RegularExpressionLiteral,
    ts.SyntaxKind.JsxText,
  ]);

  function visit(node) {
    if (literalKinds.has(node.kind)) {
      spans.push([node.getStart(sourceFile, false), node.end]);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return spans;
}

function scanJavaScriptComments(source, offset = 0, jsx = false) {
  const comments = [];
  const excluded = literalSpans(source, jsx);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    source,
  );

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }

    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    if (excluded.some(([literalStart, literalEnd]) => start >= literalStart && end <= literalEnd)) {
      continue;
    }

    comments.push({
      start: offset + start,
      end: offset + end,
      raw: scanner.getTokenText(),
      kind: token === ts.SyntaxKind.SingleLineCommentTrivia ? "line" : "block",
    });
  }

  return comments;
}

function scanBlockComments(source, offset = 0) {
  const comments = [];
  const pattern = /\/\*[\s\S]*?\*\//g;
  for (const match of source.matchAll(pattern)) {
    comments.push({
      start: offset + match.index,
      end: offset + match.index + match[0].length,
      raw: match[0],
      kind: "block",
    });
  }
  return comments;
}

function scanSvelteComments(source) {
  const comments = [];
  const occupied = [];

  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const contentStart = match.index + match[0].indexOf(">") + 1;
    const contentEnd = contentStart + match[1].length;
    occupied.push([match.index, match.index + match[0].length]);
    const openTag = match[0].slice(0, match[0].indexOf(">") + 1);
    comments.push(
      ...scanJavaScriptComments(match[1], contentStart, /(?:lang=["']tsx["']|jsx)/i.test(openTag)),
    );
    occupied.push([contentStart, contentEnd]);
  }

  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const contentStart = match.index + match[0].indexOf(">") + 1;
    occupied.push([match.index, match.index + match[0].length]);
    comments.push(...scanBlockComments(match[1], contentStart));
  }

  for (const match of source.matchAll(/<!--[\s\S]*?-->/g)) {
    if (occupied.some(([start, end]) => match.index >= start && match.index < end)) continue;
    comments.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      kind: "html",
    });
  }

  return comments.sort((left, right) => left.start - right.start);
}

export function collectComments(file, source) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".svelte") return scanSvelteComments(source);
  if (extension === ".css" || extension === ".scss") return scanBlockComments(source);
  return scanJavaScriptComments(source, 0, extension === ".tsx" || extension === ".jsx");
}

function commentBody(comment) {
  let content = comment.raw;
  if (content.startsWith("<!--")) content = content.slice(4, -3);
  else if (content.startsWith("//")) content = content.slice(2);
  else if (content.startsWith("/*")) content = content.slice(2, -2);

  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*?\s?/, "").trimEnd())
    .join("\n")
    .trim();
}

function lineBounds(source, start, end) {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const newline = source.indexOf("\n", end);
  const lineEnd = newline === -1 ? source.length : newline + 1;
  return { lineStart, lineEnd };
}

function isWholeLine(source, comment) {
  const { lineStart, lineEnd } = lineBounds(source, comment.start, comment.end);
  return (
    source.slice(lineStart, comment.start).trim() === "" &&
    source.slice(comment.end, lineEnd).trim() === ""
  );
}

function lineNumberAt(source, position) {
  let line = 1;
  for (let index = 0; index < position; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function isDecorative(body) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (/^[=\-*_#─━•·]{3,}$/u.test(oneLine)) return true;

  const wrapped = oneLine.match(/^[=\-*_#─━]{2,}\s*(.*?)\s*[=\-*_#─━]{2,}$/u);
  const prefixed = oneLine.match(/^[=\-*_#─━]{4,}\s+(.*)$/u);
  const title = wrapped?.[1] ?? prefixed?.[1] ?? null;
  if (title === null) return false;

  // A decorated sentence can still carry a real constraint. Leave those for
  // contextual review and remove only labels that are acting as visual chrome.
  return !CONTEXT_MARKER.test(title) && !/[\d(),:;→=<>]/u.test(title);
}

function isUppercaseSectionTitle(body) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return /^[A-Z][A-Z\d _/&()+.-]{2,}$/u.test(oneLine) && oneLine.length <= 80;
}

function followingDeclarationName(source, end) {
  const after = source.slice(end, end + 600);
  const callable = after.match(
    /^\s*(?:(?:export|default|declare|public|private|protected|static|abstract|async|readonly|override)\s+)*(?:function\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>{};]{0,180}>)?\s*\(/,
  );
  if (callable) return callable[1];

  const classLike = after.match(
    /^\s*(?:(?:export|default|declare|abstract)\s+)*(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
  );
  if (classLike) return classLike[1];

  const arrow = after.match(
    /^\s*(?:(?:export|default|declare)\s+)*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]{0,200})?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  );
  return arrow?.[1] ?? null;
}

function isRedundantJSDoc(source, comment) {
  if (!comment.raw.startsWith("/**") || PROTECTED_COMMENT.test(comment.raw)) return false;
  const body = commentBody(comment);
  if (!body || body.length > 120 || body.includes("\n\n") || /[@`{}()]/.test(body)) return false;
  if (CONTEXT_MARKER.test(body) || DOMAIN_COMMENT.test(body) || /[:;!?]/.test(body)) return false;

  const target = followingDeclarationName(source, comment.end);
  if (!target) return false;

  const bodyWords = meaningfulWords(body.replace(/[.]+$/, ""));
  const targetWords = new Set(meaningfulWords(target));
  if (bodyWords.length === 0 || targetWords.size === 0) return false;

  const overlap = bodyWords.filter((word) => targetWords.has(word)).length;
  const beginsWithAction = ACTION_WORDS.has(splitIdentifier(body)[0]);
  return beginsWithAction && overlap / bodyWords.length >= 0.6;
}

function nextCodeWindow(source, commentEnd) {
  const lines = source.slice(commentEnd).split(/\r?\n/);
  const selected = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    selected.push(trimmed);
    if (selected.length === 3) break;
  }
  return selected.join(" ");
}

function isDataGroupLabel(source, comment) {
  const body = commentBody(comment);
  if (!/[A-Za-z]/.test(body)) return false;
  const nextLine = source
    .slice(comment.end)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("//") && !line.startsWith("/*"));
  return nextLine?.startsWith("{") ?? false;
}

function isNarration(source, comment) {
  if (comment.kind !== "line" || !isWholeLine(source, comment)) return false;
  if (comment.raw.startsWith("///") || PROTECTED_COMMENT.test(comment.raw)) return false;

  const body = commentBody(comment).replace(/[.]+$/, "").trim();
  if (!body || body.length > 100 || CONTEXT_MARKER.test(body) || DOMAIN_COMMENT.test(body)) return false;
  if (!/^[A-Za-z][A-Za-z\d _/-]*$/u.test(body)) return false;

  const words = splitIdentifier(body);
  if (!ACTION_WORDS.has(words[0])) return false;

  const subjectWords = meaningfulWords(body).filter((word) => !ACTION_WORDS.has(word));
  if (subjectWords.length === 0) return true;

  const codeWords = new Set(meaningfulWords(nextCodeWindow(source, comment.end)));
  const overlap = subjectWords.filter((word) => codeWords.has(word)).length;
  return overlap > 0 && overlap / subjectWords.length >= 0.8;
}

function isFilePathHeader(file, source, comment) {
  if (comment.start > 300 || !isWholeLine(source, comment)) return false;
  const body = commentBody(comment).replace(/\\/g, "/").trim();
  const normalizedFile = file.replace(/\\/g, "/");
  return body === normalizedFile || body === path.basename(normalizedFile);
}

function removalForComment(source, comment, reason) {
  const { lineStart, lineEnd } = lineBounds(source, comment.start, comment.end);
  if (isWholeLine(source, comment)) {
    return { start: lineStart, end: lineEnd, commentStart: comment.start, commentEnd: comment.end, reason };
  }
  return {
    start: comment.start,
    end: comment.end,
    commentStart: comment.start,
    commentEnd: comment.end,
    reason,
  };
}

function validateRemoval(source, edit) {
  if (source.slice(edit.start, edit.commentStart).trim() !== "") return false;
  if (source.slice(edit.commentEnd, edit.end).trim() !== "") return false;
  return true;
}

function applyEdits(source, edits) {
  let output = source;
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}${output.slice(edit.end)}`;
  }
  return output;
}

function withoutCommentsAndWhitespace(file, source) {
  const comments = collectComments(file, source);
  let output = source;
  for (const comment of [...comments].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, comment.start)}${output.slice(comment.end)}`;
  }
  return output.replace(/\s+/g, "");
}

export function analyzeSource(file, source) {
  const comments = collectComments(file, source).map((comment) => ({
    ...comment,
    line: lineNumberAt(source, comment.start),
  }));
  const decorative = new Set(
    comments.filter((comment) => isDecorative(commentBody(comment))).map((comment) => comment.start),
  );
  const edits = [];

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    const body = commentBody(comment);
    let reason = null;

    if (PROTECTED_COMMENT.test(comment.raw) || comment.raw.startsWith("/*!")) continue;
    if (isFilePathHeader(file, source, comment)) reason = "file-path-header";
    else if (decorative.has(comment.start) && !isDataGroupLabel(source, comment)) {
      reason = "section-divider";
    }
    else if (isUppercaseSectionTitle(body)) {
      const previous = comments[index - 1];
      const next = comments[index + 1];
      const boundedByDividers =
        previous &&
        next &&
        decorative.has(previous.start) &&
        decorative.has(next.start) &&
        comment.line - previous.line <= 2 &&
        next.line - comment.line <= 2;
      if (boundedByDividers) reason = "section-title";
    }

    if (!reason && isRedundantJSDoc(source, comment)) reason = "restating-jsdoc";
    if (!reason && isNarration(source, comment)) reason = "syntax-narration";
    if (!reason) continue;

    const edit = removalForComment(source, comment, reason);
    if (!validateRemoval(source, edit)) {
      throw new Error(`${file}:${comment.line} candidate includes non-comment text`);
    }
    edits.push(edit);
  }

  const unique = [];
  const seen = new Set();
  for (const edit of edits.sort((left, right) => left.start - right.start)) {
    const key = `${edit.start}:${edit.end}`;
    if (seen.has(key)) continue;
    if (unique.length > 0 && edit.start < unique.at(-1).end) {
      throw new Error(`${file}: overlapping comment edits at byte ${edit.start}`);
    }
    seen.add(key);
    unique.push(edit);
  }

  const output = applyEdits(source, unique);
  if (withoutCommentsAndWhitespace(file, source) !== withoutCommentsAndWhitespace(file, output)) {
    throw new Error(`${file}: non-comment token stream changed`);
  }

  return { output, edits: unique, comments };
}

function trackedFiles(prefixes) {
  const output = execFileSync("git", ["ls-files"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => existsSync(file))
    .filter((file) => ROOTS.has(file.split("/")[0]))
    .filter((file) => EDITABLE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .filter((file) => !file.endsWith(".d.ts"))
    .filter((file) => prefixes.length === 0 || prefixes.some((prefix) => file.startsWith(prefix)));
}

function parseArguments(argv) {
  const mode = argv.includes("--apply") ? "apply" : argv.includes("--dry-run") ? "dry-run" : null;
  if (!mode || (argv.includes("--apply") && argv.includes("--dry-run"))) {
    throw new Error("Choose exactly one mode: --dry-run or --apply");
  }

  const samplesArgument = argv.find((argument) => argument.startsWith("--samples="));
  const samples = samplesArgument ? Number(samplesArgument.split("=")[1]) : 40;
  if (!Number.isInteger(samples) || samples < 0 || samples > 500) {
    throw new Error("--samples must be an integer from 0 through 500");
  }

  const prefixes = argv.filter((argument) => !argument.startsWith("--"));
  return { mode, samples, prefixes };
}

export function run(argv = process.argv.slice(2)) {
  const { mode, samples, prefixes } = parseArguments(argv);
  const files = trackedFiles(prefixes);
  const totals = {
    scannedFiles: 0,
    skippedGenerated: 0,
    changedFiles: 0,
    removedBlocks: 0,
    removedLines: 0,
    reasons: {},
  };
  const examples = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (GENERATED_BANNER.test(source.slice(0, 2000))) {
      totals.skippedGenerated += 1;
      continue;
    }

    totals.scannedFiles += 1;
    const result = analyzeSource(file, source);
    if (result.edits.length === 0) continue;

    totals.changedFiles += 1;
    totals.removedBlocks += result.edits.length;
    for (const edit of result.edits) {
      const removed = source.slice(edit.start, edit.end);
      totals.removedLines += Math.max(1, removed.split(/\r?\n/).length - 1);
      totals.reasons[edit.reason] = (totals.reasons[edit.reason] ?? 0) + 1;
      const line = lineNumberAt(source, edit.commentStart);
      examples.push({
        reason: edit.reason,
        text: `${file}:${line} [${edit.reason}] ${source.slice(edit.commentStart, edit.commentEnd).replace(/\s+/g, " ").trim()}`,
      });
    }

    if (mode === "apply") writeFileSync(file, result.output, "utf8");
  }

  console.log(JSON.stringify({ mode, prefixes, ...totals }, null, 2));
  if (examples.length > 0 && samples > 0) {
    console.log("\nSAMPLES");
    const reasons = Object.keys(totals.reasons).sort();
    const perReason = Math.max(1, Math.floor(samples / reasons.length));
    const selected = [];
    for (const reason of reasons) {
      const candidates = examples.filter((example) => example.reason === reason);
      const stride = Math.max(1, Math.floor(candidates.length / perReason));
      for (let index = Math.floor(stride / 2); index < candidates.length; index += stride) {
        selected.push(candidates[index].text);
        if (selected.length >= samples || selected.filter((item) => item.includes(`[${reason}]`)).length >= perReason) break;
      }
      if (selected.length >= samples) break;
    }
    for (const example of selected.slice(0, samples)) console.log(example);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) run();
