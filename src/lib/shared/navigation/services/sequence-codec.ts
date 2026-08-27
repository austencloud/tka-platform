import { deflateSync, inflateSync } from "fflate";

// ── base64url (RFC 4648 §5) ──────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── base45 (RFC 9285) ────────────────────────────────────────────────

const BASE45_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function base45Encode(bytes: Uint8Array): string {
  let result = "";
  let i = 0;

  while (i < bytes.length) {
    if (i + 1 < bytes.length) {
      const value = bytes[i]! * 256 + bytes[i + 1]!;
      const c = value % 45;
      const rem1 = Math.floor(value / 45);
      const b = rem1 % 45;
      const a = Math.floor(rem1 / 45);
      result += BASE45_CHARSET[c]! + BASE45_CHARSET[b]! + BASE45_CHARSET[a]!;
      i += 2;
    } else {
      const value = bytes[i]!;
      const c = value % 45;
      const b = Math.floor(value / 45);
      result += BASE45_CHARSET[c]! + BASE45_CHARSET[b]!;
      i += 1;
    }
  }

  return result;
}

function base45Decode(str: string): Uint8Array {
  const values: number[] = [];
  for (const ch of str) {
    const idx = BASE45_CHARSET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base45 character: "${ch}"`);
    values.push(idx);
  }

  const output: number[] = [];
  let i = 0;

  while (i < values.length) {
    if (i + 2 < values.length) {
      const value = values[i]! + values[i + 1]! * 45 + values[i + 2]! * 2025;
      if (value > 65535) throw new Error("base45 group exceeds 16-bit range");
      output.push((value >> 8) & 0xff, value & 0xff);
      i += 3;
    } else if (i + 1 < values.length) {
      const value = values[i]! + values[i + 1]! * 45;
      if (value > 255) throw new Error("base45 trailing pair exceeds byte range");
      output.push(value);
      i += 2;
    } else {
      throw new Error("base45 string has invalid length (trailing single char)");
    }
  }

  return new Uint8Array(output);
}


const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function compressForURL(data: string): string {
  const raw = encoder.encode(data);
  const compressed = deflateSync(raw);
  if (compressed.length >= raw.length) {
    return "raw:" + data;
  }
  return "d1:" + base64urlEncode(compressed);
}

export function decompressFromURL(encoded: string): string {
  if (encoded.startsWith("d1:")) {
    const bytes = base64urlDecode(encoded.slice(3));
    return decoder.decode(inflateSync(bytes));
  }
  if (encoded.startsWith("raw:")) {
    return encoded.slice(4);
  }
  throw new Error(`Unknown URL encoding prefix: "${encoded.slice(0, 4)}"`);
}

export function compressForQR(data: string): string {
  const raw = encoder.encode(data);
  const compressed = deflateSync(raw);
  if (compressed.length >= raw.length) {
    return "raw:" + data;
  }
  return "q1:" + base45Encode(compressed);
}

export function decompressFromQR(encoded: string): string {
  if (encoded.startsWith("q1:")) {
    const bytes = base45Decode(encoded.slice(3));
    return decoder.decode(inflateSync(bytes));
  }
  if (encoded.startsWith("raw:")) {
    return encoded.slice(4);
  }
  throw new Error(`Unknown QR encoding prefix: "${encoded.slice(0, 4)}"`);
}
