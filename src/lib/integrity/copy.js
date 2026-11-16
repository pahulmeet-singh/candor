/**
 * What an assessment does and does not do, in the words the candidate reads. One list, shown on the
 * booking form, the interview details page and the start panel, so the three can never disagree.
 *
 * Every line is a promise about the code, so each one is backed by something that can be checked:
 *  1. the camera is read in the browser (MediaPipe runs on the device; no frame is ever sent),
 *  2. the thresholds are INTEGRITY_RULES (3 s, 2 s and 4 s),
 *  3. the paste threshold is INTEGRITY_RULES.pasteMinChars,
 *  4. the events table has no column for media or text (tests/integrity-enums.test.js) and a
 *     CHECK constraint on `detail` (migration 20261112000000_integrity_monitoring),
 *  5. nothing in the evaluation reads the events (src/lib/services/session.js).
 */
export const MONITORING_PROMISES = [
  "Your camera is read on your own device. No video or pictures are uploaded or saved.",
  "Candor notes when no face, more than one face, or a head turned away is in view for a few seconds.",
  "It also notes leaving this tab, clicking into another window, and pasting a large block of text into an answer.",
  "Only the kind, time and length of each event are saved. Never your video, and never the text you pasted.",
  "These appear in your report as signals for review. They do not change your score.",
];

export const CONSENT_LABEL = "I agree to the camera and focus checks described above.";

export const PRACTICE_BLURB = "Private. Nothing is watched. Best for learning.";
export const ASSESSMENT_BLURB =
  "Camera and focus checks run, and show in your report. For a realistic, supervised run.";
