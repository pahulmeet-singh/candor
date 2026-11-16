import "server-only";

/**
 * Typed, lazy access to environment variables.
 *
 * Values are read when used (getters), not when the module loads, so
 * `next build` succeeds without secrets and tests can change `process.env`.
 * Empty strings are treated as "not set", which is what `.env.example` ships.
 */

const read = (key) => {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
};

const flag = (key, fallback) => {
  const value = read(key);
  return value === undefined ? fallback : ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

/** `AI_MODE` wins; otherwise Gemini when a key exists and the offline evaluator when it does not. */
export function resolveAiMode() {
  const explicit = read("AI_MODE")?.toLowerCase();
  if (explicit === "mock" || explicit === "gemini") return explicit;
  return read("GEMINI_API_KEY") ? "gemini" : "mock";
}

export const env = {
  /** Lets a SCHEDULED interview start at any time (demos and the viva). */
  get demoMode() {
    return flag("DEMO_MODE", false);
  },
  get aiMode() {
    return resolveAiMode();
  },
  /** When Gemini fails, fall back to the offline provider instead of failing the request. */
  get aiFallback() {
    return flag("AI_FALLBACK", true);
  },
  get geminiApiKey() {
    return read("GEMINI_API_KEY");
  },
  get geminiModel() {
    return read("GEMINI_MODEL") ?? "gemini-3.8-flash";
  },
  get supabaseUrl() {
    return read("SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get resumeBucket() {
    return read("SUPABASE_RESUME_BUCKET") ?? "resumes";
  },
  get storageConfigured() {
    return Boolean(read("SUPABASE_URL") && read("SUPABASE_SERVICE_ROLE_KEY"));
  },
  get googleAuthEnabled() {
    return Boolean(read("AUTH_GOOGLE_ID") && read("AUTH_GOOGLE_SECRET"));
  },
};
