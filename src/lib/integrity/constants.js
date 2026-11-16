/**
 * Integrity monitoring: the vocabulary shared by the browser, the server and the tests.
 *
 * Keep this file free of Prisma, Next.js and DOM code. The monitor in the browser imports it, and
 * so do the service, the validation schema and the unit tests. tests/integrity-enums.test.js
 * compares the two lists below with the enums in prisma/schema.prisma, so they cannot drift apart.
 */

/** PRACTICE is private and nothing is watched. ASSESSMENT turns the checks on, with the candidate's consent. */
export const INTERVIEW_MODES = ["PRACTICE", "ASSESSMENT"];

export const INTEGRITY_EVENT_TYPES = [
  "FACE_MISSING",
  "MULTIPLE_FACES",
  "LOOKING_AWAY",
  "TAB_HIDDEN",
  "FOCUS_LOST",
  "PASTE",
  "CAMERA_OFF",
];

/** Events that happen at a single moment, so they never have a duration. */
export const INSTANT_EVENT_TYPES = new Set(["PASTE", "CAMERA_OFF"]);

export const EVENT_LABELS = {
  FACE_MISSING: "Face out of frame",
  MULTIPLE_FACES: "More than one face in view",
  LOOKING_AWAY: "Looking away from the screen",
  TAB_HIDDEN: "Left the interview tab",
  FOCUS_LOST: "Clicked into another window",
  PASTE: "Pasted text into an answer",
  CAMERA_OFF: "Camera not available",
};

/** Shown, and returned as a field error, when someone picks ASSESSMENT without agreeing to the checks. */
export const CONSENT_REQUIRED_MESSAGE = "Tick the box to agree to the camera and focus checks, or choose Practice.";

/** Said wherever the flags are shown, because a flag is a reason to look, not a finding. */
export const INTEGRITY_DISCLAIMER =
  "These are signals for a person to review, not proof of anything. Cameras, lighting, glasses, a second monitor and ordinary browsers all cause false alarms.";

/** Every threshold in one place, so the behaviour can be tuned and tested without touching the logic. */
export const INTEGRITY_RULES = {
  /** A span must last this long (ms) before it is worth a flag. */
  faceMissingMs: 3_000,
  multipleFacesMs: 2_000,
  lookingAwayMs: 4_000,
  tabHiddenMs: 1_000,
  focusLostMs: 3_000,
  /** Sideways head turn, in eye-distances (see head-pose.js). About 0.35 is a turn of roughly 30 degrees. */
  lookingAwayYaw: 0.35,
  /** A paste of at least this many characters is recorded; shorter ones are normal editing. */
  pasteMinChars: 40,
  /** A condition may switch off for this long without ending its span, because detectors flicker. */
  graceMs: 700,
  /** How often the camera picture is examined. Five times a second is plenty and cheap. */
  detectEveryMs: 200,
  /** The browser sends what it has collected this often. */
  flushEveryMs: 10_000,
  maxEventsPerRequest: 50,
  maxEventsPerInterview: 300,
  /** No single span can be longer than a session. */
  maxSpanMs: 60 * 60 * 1000,
  /** The server accepts an event this much before the interview began or after "now", to forgive small clock errors. */
  clockSlackMs: 60_000,
};
