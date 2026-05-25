import type { Commitment, Email, ExtractionResult } from "../types.ts";

export type Provider = "lovable" | "anthropic" | "openai";

interface ExtractOptions {
  provider: Provider;
  model: string;
  apiKey: string;
}

const SYSTEM_PROMPT = `You are a commitment-extraction assistant. Analyze the email and extract every commitment.

A commitment is an actionable obligation a person now holds. It must be:
- Actionable (something a human can do)
- Owned by someone (the recipient, sender, or a named third party)
- Forward-looking (not yet done)

Sources of commitments:
- Implicitly accepted by the recipient ("Yes, I'll send the draft Friday")
- Explicitly asked of the recipient ("Can you send the draft Friday?")
- Tracked as owed to the recipient ("Sarah will send the draft Friday")

NOT commitments:
- Questions without an action
- FYIs or status updates
- Past-tense / already-completed work
- Social pleasantries
- Conditional intentions without acceptance
- Newsletter / digest / automated mail

Return a JSON object with this exact shape — no markdown fences, no prose:
{
  "commitments": [
    {
      "task": "specific actionable description starting with a verb",
      "owner": "me" | "other",
      "ownerName": "Name if owner is 'other', else empty string",
      "dueDate": "YYYY-MM-DD or empty string if none",
      "priority": "high" | "medium" | "low",
      "sourceQuote": "exact phrase from the email that produced this commitment"
    }
  ]
}

Rules:
- "me" = the To: recipient of the email
- Empty array if no commitments
- Resolve relative dates (Friday, next week, EOD) to absolute YYYY-MM-DD using the email date as reference
- "high" = urgent/blocking, "medium" = default, "low" = nice-to-have`;

export async function extractFromEmail(
  email: Email,
  options: ExtractOptions,
): Promise<ExtractionResult> {
  const userContent = formatEmail(email);
  const start = Date.now();

  try {
    const raw = await callProvider(SYSTEM_PROMPT, userContent, options);
    const parsed = parseResponse(raw);
    return {
      emailId: email.id,
      extracted: parsed,
      rawResponse: raw,
      model: options.model,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      emailId: email.id,
      extracted: [],
      error: e instanceof Error ? e.message : String(e),
      model: options.model,
      latencyMs: Date.now() - start,
    };
  }
}

function formatEmail(email: Email): string {
  const lines = [
    `From: ${email.from}`,
    `To: ${email.to.join(", ")}`,
  ];
  if (email.cc && email.cc.length > 0) lines.push(`Cc: ${email.cc.join(", ")}`);
  lines.push(`Date: ${email.date}`);
  lines.push(`Subject: ${email.subject}`);
  lines.push("");
  lines.push(email.body);
  return lines.join("\n");
}

async function callProvider(
  systemPrompt: string,
  userContent: string,
  options: ExtractOptions,
): Promise<string> {
  if (options.provider === "lovable") {
    return callLovable(systemPrompt, userContent, options);
  }
  if (options.provider === "anthropic") {
    return callAnthropic(systemPrompt, userContent, options);
  }
  return callOpenAI(systemPrompt, userContent, options);
}

async function callLovable(systemPrompt: string, userContent: string, options: ExtractOptions): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Lovable gateway ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(systemPrompt: string, userContent: string, options: ExtractOptions): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

async function callOpenAI(systemPrompt: string, userContent: string, options: ExtractOptions): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseResponse(raw: string): Commitment[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object in response: ${raw.slice(0, 200)}`);
  }
  const json = JSON.parse(cleaned.slice(start, end + 1));
  const commitments = Array.isArray(json.commitments) ? json.commitments : [];

  return commitments.map((c: Record<string, unknown>) => ({
    task: String(c.task ?? ""),
    owner: c.owner === "me" ? "me" : "other",
    ownerName: c.ownerName ? String(c.ownerName) : undefined,
    dueDate: c.dueDate ? String(c.dueDate) : undefined,
    priority: ["high", "medium", "low"].includes(String(c.priority)) ? c.priority as "high" | "medium" | "low" : undefined,
    sourceQuote: c.sourceQuote ? String(c.sourceQuote) : undefined,
  }));
}
