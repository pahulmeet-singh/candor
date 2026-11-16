import { INTEGRITY_RULES } from "./constants";

/**
 * The browser's side of delivery: events wait here until they are sent, and are sent in order,
 * a request at a time. It knows nothing about React, the camera or the DOM, so the rules for
 * retrying, batching and limits are unit tested with a fake `send`.
 */

export class EventOutbox {
  pending = [];
  tail = Promise.resolve();

  constructor(
    send,
    now = Date.now,
    limits = {
      batch: INTEGRITY_RULES.maxEventsPerRequest,
      held: INTEGRITY_RULES.maxEventsPerInterview,
    },
  ) {
    this.send = send;
    this.now = now;
    this.limits = limits;
  }

  /** How many events are waiting. */
  get size() {
    return this.pending.length;
  }

  add(events) {
    this.pending.push(...events);
    // An offline laptop must not grow this without end. The server stops at the same number and keeps
    // the earliest events, so the newest are the ones given up.
    if (this.pending.length > this.limits.held) this.pending.splice(this.limits.held);
  }

  /**
   * Sends everything waiting, one request at a time, and resolves when that is done. A second caller
   * queues behind the first, so two flushes never overlap and the last one to resolve has seen everything.
   */
  flush() {
    const run = this.tail.then(() => this.drain());
    this.tail = run;
    return run;
  }

  async drain() {
    while (this.pending.length > 0) {
      const events = this.pending.slice(0, this.limits.batch);
      let result;
      try {
        result = await this.send({ sentAtMs: this.now(), events });
      } catch {
        result = "retry";
      }
      if (result === "retry") return;
      // Anything added while the request was in the air sits behind these, so taking from the front is exact.
      this.pending.splice(0, events.length);
    }
  }
}

/**
 * The real `send`: POST /api/interviews/:id/integrity. `keepalive` lets the request finish even
 * while the page is closing, which is how the last events of a session still arrive.
 */
export function postBatchTo(interviewId, doFetch = (...args) => fetch(...args)) {
  return async (batch) => {
    try {
      const response = await doFetch(`/api/interviews/${encodeURIComponent(interviewId)}/integrity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      });
      if (response.ok) return "sent";
      // Busy or broken on the server's side: worth another go. Anything else is a refusal that will not change.
      return response.status === 408 || response.status === 429 || response.status >= 500 ? "retry" : "drop";
    } catch {
      return "retry";
    }
  };
}
