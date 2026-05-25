import { readFileSync } from "node:fs";
import type { Email } from "../types.ts";

const FROM_LINE = /^From .+\d{4}$/m;

export function parseMbox(filePath: string): Email[] {
  const raw = readFileSync(filePath, "utf-8");
  const blocks = splitMboxBlocks(raw);

  return blocks
    .map((block, idx) => parseBlock(block, idx))
    .filter((e): e is Email => e !== null);
}

function splitMboxBlocks(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (FROM_LINE.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

function parseBlock(block: string, idx: number): Email | null {
  const headerEnd = block.indexOf("\n\n");
  if (headerEnd === -1) return null;

  const headerText = unfoldHeaders(block.slice(0, headerEnd));
  const bodyText = block.slice(headerEnd + 2);

  const headers = parseHeaders(headerText);

  const messageId = headers["message-id"]?.replace(/[<>]/g, "");
  const from = headers["from"] ?? "";
  const to = splitAddresses(headers["to"] ?? "");
  const cc = splitAddresses(headers["cc"] ?? "");
  const subject = decodeHeader(headers["subject"] ?? "");
  const date = headers["date"] ?? "";

  const body = extractTextBody(bodyText, headers["content-type"] ?? "");

  if (!subject && !body.trim()) return null;

  return {
    id: `email-${String(idx + 1).padStart(3, "0")}`,
    messageId,
    from: decodeHeader(from),
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    date,
    body,
  };
}

function unfoldHeaders(headerText: string): string {
  return headerText.replace(/\r?\n[ \t]+/g, " ");
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function splitAddresses(value: string): string[] {
  if (!value) return [];
  return value.split(",").map((s) => decodeHeader(s.trim())).filter(Boolean);
}

function decodeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_m, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString(charset.toLowerCase().includes("utf") ? "utf-8" : "latin1");
      }
      return text.replace(/_/g, " ").replace(/=([A-F0-9]{2})/gi, (_m2: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    } catch {
      return text;
    }
  });
}

function extractTextBody(body: string, contentType: string): string {
  const lower = contentType.toLowerCase();

  if (lower.includes("multipart/")) {
    const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
    if (!boundaryMatch) return stripQuoted(body);
    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);
    const textPart = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    if (textPart) {
      const partHeaderEnd = textPart.indexOf("\n\n");
      const partBody = partHeaderEnd === -1 ? textPart : textPart.slice(partHeaderEnd + 2);
      return stripQuoted(partBody);
    }
    return stripQuoted(parts[0] ?? body);
  }

  if (lower.includes("text/html")) {
    return stripQuoted(htmlToText(body));
  }

  return stripQuoted(body);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

function stripQuoted(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message/i.test(line.trim())) break;
    if (/^From: .+\b\d{4}\b/.test(line.trim()) && out.length > 5) break;
    out.push(line);
  }
  return out.join("\n").trim();
}
