import { EVENT_LABELS, INTEGRITY_EVENT_TYPES } from "./constants";

/**
 * Turns the stored events of one session into what the report shows: a level, a one-line headline,
 * a count per kind and a timeline. Pure and deterministic, so it is unit tested without a database.
 *
 * The level is a reading aid with deliberately blunt thresholds. It says "someone may want to look",
 * never "this person cheated": the score is built from signals a nervous candidate, a bad webcam or
 * a notification can all trigger.
 */

/** Up to this many whole 10-second blocks add to the points of a long event. */
const MAX_DURATION_BLOCKS = 6;
const BLOCK_MS = 10_000;
/** At this many points a person should look at the timeline. Anything above zero is "noted". */
export const REVIEW_AT_POINTS = 6;
const LARGE_PASTE_CHARS = 200;

export function pointsFor(event) {
  const blocks = Math.min(MAX_DURATION_BLOCKS, Math.floor(Math.max(0, event.durationMs) / BLOCK_MS));
  switch (event.type) {
    case "FACE_MISSING":
      return 2 + blocks;
    case "MULTIPLE_FACES":
      return 4 + blocks;
    case "LOOKING_AWAY":
      return 1 + blocks;
    case "TAB_HIDDEN":
      return 3 + blocks;
    case "FOCUS_LOST":
      return 1;
    case "PASTE":
      return (event.detail?.chars ?? 0) >= LARGE_PASTE_CHARS ? 4 : 2;
    case "CAMERA_OFF":
      return 2;
  }
}

export function levelFor(points) {
  if (points >= REVIEW_AT_POINTS) return "REVIEW";
  if (points > 0) return "NOTED";
  return "CLEAR";
}

const HEADLINES = {
  CLEAR: "No interruptions were noted.",
  NOTED: "A few interruptions were noted.",
  REVIEW: "Several interruptions were noted. Someone should look at the timeline.",
};

export function summarizeIntegrity(events, context) {
  const sessionStart = context.sessionStartedAt ? Date.parse(context.sessionStartedAt) : Number.NaN;
  const ordered = [...events].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id),
  );

  const timeline = ordered.map((event) => {
    const offset = Date.parse(event.startedAt) - sessionStart;
    const index = event.questionId ? context.questionIds.indexOf(event.questionId) : -1;
    return {
      id: event.id,
      type: event.type,
      label: EVENT_LABELS[event.type],
      offsetMs: Number.isFinite(offset) ? Math.max(0, offset) : 0,
      durationMs: Math.max(0, event.durationMs),
      questionNumber: index >= 0 ? index + 1 : null,
      note: event.type === "PASTE" && event.detail?.chars ? `${event.detail.chars} characters` : null,
    };
  });

  const byType = INTEGRITY_EVENT_TYPES.map((type) => {
    const matching = ordered.filter((event) => event.type === type);
    return {
      type,
      label: EVENT_LABELS[type],
      count: matching.length,
      totalMs: matching.reduce((sum, event) => sum + Math.max(0, event.durationMs), 0),
    };
  }).filter((row) => row.count > 0);

  const points = ordered.reduce((sum, event) => sum + pointsFor(event), 0);
  const level = levelFor(points);

  return { level, points, headline: HEADLINES[level], totalEvents: ordered.length, byType, timeline };
}
