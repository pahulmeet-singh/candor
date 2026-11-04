/** Product limits shared by the UI, the validation schemas and the services. */

/** How many questions one interview session contains. */
export const QUESTIONS_PER_SESSION = 5;

/** Longest answer we accept per question (characters). */
export const ANSWER_MAX_CHARS = 4000;

/** Shortest answer we treat as "attempted" (words). Anything below is scored 0 as empty. */
export const ANSWER_MIN_WORDS = 3;

/** Résumé upload: 4 MB keeps us under Vercel's 4.5 MB request-body ceiling. */
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;
export const RESUME_MIME = "application/pdf";

/** Default page size for lists (history, admin). */
export const PAGE_SIZE = 8;

/** How long a signed résumé download link stays valid (seconds). */
export const SIGNED_URL_TTL_SECONDS = 60;

/** How many past reports feed the dashboard trend chart. */
export const TREND_POINTS = 12;
