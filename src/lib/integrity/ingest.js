import { INSTANT_EVENT_TYPES, INTEGRITY_RULES } from "./constants";

/**
 * What the server does with a batch of events from the browser, as a pure function so every rule is
 * unit tested without a database. The browser is not trusted (anyone can edit what it sends), so the
 * server decides what is kept, and what is kept is only ever facts about the session.
 */

export function ingestEvents(drafts, context, rules = INTEGRITY_RULES) {
  // The browser stamps events with its own clock, and a laptop whose clock is five minutes fast would
  // make every event look as if it came from the future. The batch says what time the browser thought
  // it was when it sent it, so the difference from the server's clock is the offset, and each event
  // is moved by that offset onto the server's timeline. Only then is it compared with the session.
  const offsetMs = context.nowMs - context.sentAtMs;
  const earliestMs = context.sessionStartMs - rules.clockSlackMs;
  const latestMs = context.nowMs + rules.clockSlackMs;

  const events = [];
  let dropped = 0;

  for (const draft of drafts) {
    // Pastes and camera failures happen at a single moment, whatever the browser claims.
    const durationMs = INSTANT_EVENT_TYPES.has(draft.type) ? 0 : draft.durationMs;
    const startMs = draft.startedAtMs + offsetMs;

    // Checked before the limit, so events that would be refused anyway never use up room.
    const inSession = startMs >= earliestMs && startMs + durationMs <= latestMs;
    if (!inSession || events.length >= context.capacityLeft) {
      dropped += 1;
      continue;
    }

    events.push({
      type: draft.type,
      questionId: draft.questionId !== null && context.questionIds.has(draft.questionId) ? draft.questionId : null,
      startedAt: new Date(startMs),
      durationMs,
      // Only a paste has anything to add, and all it may add is how long the pasted text was.
      detail: draft.type === "PASTE" && draft.detail ? { chars: draft.detail.chars } : null,
    });
  }

  return { events, dropped };
}
