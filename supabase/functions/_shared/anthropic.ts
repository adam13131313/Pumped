// Shared Anthropic API helper for edge functions.
//
// Why this exists: the AI-backed edge functions all called the Lovable AI
// gateway with OpenAI-style chat completions. Pumped is standardising on
// Anthropic per the strategic direction, so each function now calls
// api.anthropic.com directly. This module is the single source of truth
// for that integration.
//
// Auth: reads ANTHROPIC_API_KEY from the function's environment. Set it
// via:  supabase secrets set ANTHROPIC_API_KEY=... --project-ref <ref>

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Latest Claude model IDs. Update here only — every function imports from
// this module so a model bump is one edit.
export const ANTHROPIC_MODELS = {
  // Fast + cheap. Good for chat, classification, small extractions.
  haiku: "claude-haiku-4-5-20251001",
  // Workhorse for structured extraction, multimodal, complex generation.
  sonnet: "claude-sonnet-4-6",
  // Highest quality. Reserve for tasks where it visibly matters.
  opus: "claude-opus-4-7",
} as const;

export type TextBlock = { type: "text"; text: string };
export type ImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string;
  };
};
export type ContentBlock = TextBlock | ImageBlock;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface AnthropicCallOptions {
  model: string;
  systemPrompt: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}

export class AnthropicError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(`Anthropic API ${status}: ${bodyText.slice(0, 300)}`);
    this.name = "AnthropicError";
  }
}

export async function callAnthropic(opts: AnthropicCallOptions): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set in Supabase secrets. Add it via " +
        "`supabase secrets set ANTHROPIC_API_KEY=...` or the project dashboard.",
    );
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.systemPrompt,
      messages: opts.messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AnthropicError(response.status, body);
  }

  const data = await response.json();
  const block = data?.content?.[0];
  if (!block || block.type !== "text") {
    return "";
  }
  return block.text ?? "";
}

// Convert a browser-style data URL (e.g. data:image/png;base64,iVBOR...)
// into an Anthropic image content block.
export function dataUrlToImageBlock(dataUrl: string, name?: string): ImageBlock {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error(`Image '${name ?? "(unnamed)"}' has an unsupported data URL format`);
  }
  const rawMediaType = match[1].toLowerCase();
  const mediaType = (rawMediaType === "image/jpg" ? "image/jpeg" : rawMediaType) as ImageBlock["source"]["media_type"];
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data: match[2],
    },
  };
}

// Map errors to user-facing response payload.
//
// IMPORTANT: customer-facing messages never name the provider, mention API
// keys, billing, credits, or other implementation details. The point is to
// tell the end user that an AI feature is briefly unavailable without
// revealing that the operator forgot to top up their AI credits.
//
// Operator visibility comes from the console.error below, which lands in
// Supabase Functions logs alongside the request id.
const GENERIC_AI_ERROR_MESSAGE = "AI features are temporarily unavailable. Please try again shortly.";
const RATE_LIMIT_MESSAGE = "Too many requests just now. Please try again in a moment.";

export function explainAnthropicError(err: unknown): { status: number; payload: { error: string } } {
  // Server-side log for operators — this is the place to surface the real cause.
  if (err instanceof AnthropicError) {
    console.error(`[ai-error] upstream HTTP ${err.status}: ${err.bodyText.slice(0, 1000)}`);
  } else if (err instanceof Error) {
    console.error(`[ai-error] ${err.name}: ${err.message}`);
  } else {
    console.error(`[ai-error] non-Error thrown:`, err);
  }

  // Only the rate-limit case gets a distinct message so end users know to
  // wait a few seconds rather than retrying repeatedly. Everything else
  // (credit balance, invalid key, 5xx, config errors) collapses to one
  // generic message.
  if (err instanceof AnthropicError && err.status === 429) {
    return { status: 200, payload: { error: RATE_LIMIT_MESSAGE } };
  }
  return { status: 200, payload: { error: GENERIC_AI_ERROR_MESSAGE } };
}
