import "server-only";

/**
 * Typed, lazy access to environment variables.
 *
 * Values are read when used (getters), not when the module loads, so
 * `next build` succeeds without secrets and tests can change `process.env`.
 * Empty strings are treated as "not set", which is what `.env.example` ships.
 */

const read = (key: string): string | undefined => {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
};

const flag = (key: string, fallback: boolean): boolean => {
  const value = read(key);
  return value === undefined ? fallback : ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export type AiMode = "gemini" | "mock";

/** `AI_MODE` wins; otherwise Gemini when a key exists and the offline evaluator when it does not. */
export function resolveAiMode(): AiMode {
  const explicit = read("AI_MODE")?.toLowerCase();
  if (explicit === "mock" || explicit === "gemini") return explicit;
  return read("GEMINI_API_KEY") ? "gemini" : "mock";
}

export const env = {
  /** Lets a SCHEDULED interview start at any time (demos and the viva). */
  get demoMode(): boolean {
    return flag("DEMO_MODE", false);
  },
  get aiMode(): AiMode {
    return resolveAiMode();
  },
  /** When Gemini fails, fall back to the offline provider instead of failing the request. */
  get aiFallback(): boolean {
    return flag("AI_FALLBACK", true);
  },
  get geminiApiKey(): string | undefined {
    return read("GEMINI_API_KEY");
  },
  get geminiModel(): string {
    return read("GEMINI_MODEL") ?? "gemini-3.8-flash";
  },
  get supabaseUrl(): string | undefined {
    return read("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string | undefined {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get resumeBucket(): string {
    return read("SUPABASE_RESUME_BUCKET") ?? "resumes";
  },
  get storageConfigured(): boolean {
    return Boolean(read("SUPABASE_URL") && read("SUPABASE_SERVICE_ROLE_KEY"));
  },
  get googleAuthEnabled(): boolean {
    return Boolean(read("AUTH_GOOGLE_ID") && read("AUTH_GOOGLE_SECRET"));
  },
} as const;
