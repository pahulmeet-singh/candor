import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * A small client for Gemini's `generateContent` REST endpoint.
 *
 * We call it with `fetch` rather than an SDK: it is one POST, it keeps the
 * dependency list short, and every moving part (headers, body, error mapping)
 * is visible in one file for the viva.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiJsonRequest {
  system: string;
  prompt: string;
  /** JSON Schema for the reply (see lib/ai/schemas.ts). */
  schema: Record<string, unknown>;
  /** Optional résumé PDF, sent inline. */
  pdf?: Uint8Array | null;
  temperature?: number;
  timeoutMs?: number;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

async function post(url: string, apiKey: string, body: unknown, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    logger.warn("gemini.network", { timedOut, error });
    throw new AppError(
      "AI_UNAVAILABLE",
      timedOut ? "The AI service took too long to answer." : "We could not reach the AI service.",
      { cause: error },
    );
  }
}

/** Models occasionally wrap JSON in a code fence or add a sentence around it. */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) candidates.push(fenced[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try the next form
    }
  }
  throw new AppError("AI_BAD_OUTPUT", "The AI service replied in an unexpected format.");
}

/** Sends one prompt and returns the parsed JSON reply (not yet validated: callers use Zod). */
export async function geminiJson(request: GeminiJsonRequest): Promise<{ json: unknown; model: string }> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) throw new AppError("AI_UNAVAILABLE", "No Gemini API key is configured on this server.");

  const model = env.geminiModel;
  const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent`;
  const timeoutMs = request.timeoutMs ?? 45_000;

  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
  if (request.pdf) parts.push({ inlineData: { mimeType: "application/pdf", data: toBase64(request.pdf) } });

  const body = (withSchema: boolean) => ({
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: request.temperature ?? 0.4,
      responseMimeType: "application/json",
      ...(withSchema ? { responseJsonSchema: request.schema } : {}),
    },
  });

  const deadline = Date.now() + timeoutMs;
  let response = await post(url, apiKey, body(true), timeoutMs);

  // If the API rejects the schema field itself (it has been renamed before), ask again
  // without it. The prompt still demands JSON and Zod validates the reply either way.
  // The second request only gets the time that is left, so one call never takes longer than `timeoutMs`.
  if (response.status === 400) {
    const detail = await response.clone().text();
    if (/response_?json_?schema|response_?schema|generation_?config/i.test(detail)) {
      logger.warn("gemini.schema_rejected", { detail: detail.slice(0, 300) });
      response = await post(url, apiKey, body(false), Math.max(1_000, deadline - Date.now()));
    }
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    logger.error("gemini.http_error", { status: response.status, model, detail });
    if (response.status === 429) {
      throw new AppError("AI_RATE_LIMITED", "The AI service is busy right now. Wait a moment and try again.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError("AI_UNAVAILABLE", "The AI service rejected this server's credentials.");
    }
    if (response.status === 404) {
      throw new AppError("AI_UNAVAILABLE", `The AI model "${model}" was not found. Check GEMINI_MODEL.`);
    }
    throw new AppError("AI_UNAVAILABLE", "The AI service is having trouble right now.");
  }

  const payload = (await response.json()) as GeminiResponse;
  if (payload.promptFeedback?.blockReason) {
    throw new AppError("AI_BAD_OUTPUT", "The AI service declined to process this content.");
  }

  // Thinking models can return reasoning "thought" parts first; only the answer parts carry the JSON.
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
  if (text.trim() === "") throw new AppError("AI_BAD_OUTPUT", "The AI service returned an empty reply.");

  return { json: parseLooseJson(text), model };
}
