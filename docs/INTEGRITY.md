# Integrity monitoring (assessment mode)

Candor can run an interview in one of two modes. **Practice** is private: nothing is watched. **Assessment** adds a presence check: the candidate's browser notices when no face, more than one face, or a turned head is in front of the camera, when the interview tab is left, and when a large block of text is pasted into an answer. What it notices appears in the report as a short list of signals.

This is not proctoring software and it does not pretend to be. It produces **signals for a person to review, not proof**, it never changes the score, and the candidate agrees to it first and can see everything it looks at. This document explains how it works and where its limits are.

- [1. The two modes](#1-the-two-modes)
- [2. What is noticed](#2-what-is-noticed)
- [3. How it works](#3-how-it-works)
- [4. Privacy](#4-privacy)
- [5. The trust model](#5-the-trust-model)
- [6. Setup and tuning](#6-setup-and-tuning)
- [7. Try it](#7-try-it)
- [8. Where the code is](#8-where-the-code-is)
- [9. Decisions and trade-offs](#9-decisions-and-trade-offs)
- [Known limits](#known-limits)

---

## 1. The two modes

| | **Practice** (default) | **Assessment** |
| --- | --- | --- |
| Camera | Never requested | Requested when the room opens |
| Tab and focus | Not watched | Watched |
| Pastes | Not watched | Counted (40 characters or more) |
| Candidate must agree first | No | **Yes**: a checkbox on the booking form |
| In the report | Nothing | A "Presence and focus" section |
| Effect on the score | None | **None** |

The mode is chosen when booking (`mode` on `POST /api/interviews`). The app has no way to change it afterwards, and the database would refuse a switch to assessment without a recorded consent time.

Five principles shaped the design:

1. **Opt in, in words the candidate reads.** The same five promises (`lib/integrity/copy.js`) are shown on the booking form, on the interview's details page and again on the start panel, so the three can never disagree.
2. **On the device.** The camera picture is analysed in the candidate's own browser. No frame, image or video is uploaded or saved.
3. **Metadata only.** What is stored is the kind of event, when it began, how long it lasted, which question was showing and, for a paste, how many characters. Never the text.
4. **Visible.** While an assessment runs, the candidate sees their own camera picture, what the checks see right now ("One face in view, facing the screen"), and how many flags there are so far. Being watched without being told what is being looked at is the part of proctoring people object to.
5. **A signal, not a verdict.** The report says so twice, and no code path lets an event touch the score.

## 2. What is noticed

| Event | Meaning | Must last | Points |
| --- | --- | --- | --- |
| `FACE_MISSING` | The detector sees no face | 3 s | 2, plus 1 per full 10 s (up to +6) |
| `MULTIPLE_FACES` | Two or more faces in the picture | 2 s | 4, plus 1 per full 10 s (up to +6) |
| `LOOKING_AWAY` | Exactly one face, and the head is turned: \|yaw\| ≥ 0.35 | 4 s | 1, plus 1 per full 10 s (up to +6) |
| `TAB_HIDDEN` | The tab is hidden (switched tab, minimised window) | 1 s | 3, plus 1 per full 10 s (up to +6) |
| `FOCUS_LOST` | The window lost focus while the tab stayed visible (clicked into another window) | 3 s | 1 |
| `PASTE` | 40 or more characters pasted into an answer | instant | 2 (4 from 200 characters) |
| `CAMERA_OFF` | The camera was blocked, unplugged, missing, or the face model failed to load | instant | 2, once per page load |

A hidden tab also loses focus, so the page tracker counts that once, as the more specific `TAB_HIDDEN`.

Points add up into a level shown as a badge: **0 = Nothing noted**, **1 to 5 = A few noted**, **6 or more = Worth a look**. The unit tests (`tests/integrity-summary.test.js`) and the integration test pin these numbers; for example a tab hidden for 12 s (3 + 1) plus a paste of 250 characters (4) is 8 points.

Every number lives in one object, `INTEGRITY_RULES` in `lib/integrity/constants.js`, so behaviour can be tuned without touching the logic.

## 3. How it works

```
 camera ──▶ <video> ──▶ MediaPipe FaceDetector (WebAssembly, on this device)
                              │ 5 times a second: faces, each with 6 keypoints
                              ▼
 page events (visibilitychange, blur, focus) ───┐
 paste in the answer box (its length only) ─────┼──▶ IntegrityTracker   "has this lasted long enough?"
                                                │          │ events
                                                ▼          ▼
                                           EventOutbox  (a queue; batches of up to 50; one request at a time)
                                                           │ every 10 s, and once more as the page closes
 ─────────────────────────── network ──────────────────────▼─────────────────────────────────────────────
 POST /api/interviews/:id/integrity ──▶ Zod strictObject ──▶ ingestEvents ──▶ IntegrityEvent rows
                                                      (shape)     (clock, window, caps)   (+ CHECK constraints)
                                                                                    │
 report page ◀── summarizeIntegrity (points, level, timeline) ◀──────────────────────┘
```

### 3.1 Is the head turned? (`head-pose.js`)

MediaPipe's face detector (BlazeFace, short range) returns six keypoints per face: both eyes, the nose tip, the mouth and both ears. Facing the screen, the nose sits halfway between the eyes. Turn the head and the nose slides toward one eye. So:

```
yaw = (nose.x - midpoint of the eyes) / distance between the eyes
```

is about 0 when facing the screen and grows as the head turns. `|yaw| ≥ 0.35` counts as looking away. It is a cheap geometric estimate, not a trained head-pose model, which is good enough to notice someone reading from a second screen and will sometimes be wrong. It returns "unknown" (and so is never a flag) with fewer than three points or when the eyes are too close together to measure. **The 0.35 threshold was chosen by reasoning, not measured on real faces** (see [Known limits](#known-limits)).

### 3.2 When does a condition become a flag? (`tracker.js`)

A glance at a keyboard is not a flag. `SpanTracker` watches one yes/no condition over time and reports it only once it has lasted its minimum (3 s for a missing face, and so on). Two sources feed it in two ways:

- **Camera frames are sampled** every 200 ms, and a detector can flicker for a frame or two. A gap shorter than `graceMs` (700 ms) does not end the span. A span ends at the last sample that still saw the condition. A longer silence, whether "no" samples or no samples at all (a throttled background tab stops sampling), closes the span at the last sighting: a gap in sampling is never taken as evidence that the condition carried on.
- **Page events are edges.** The browser says "hidden" once and "visible" once, so the span runs from one event to the other.

When the candidate submits, or the page is closing, `flush()` closes every open span.

### 3.3 Getting the events to the server (`outbox.js`, `use-integrity-monitor.js`)

`EventOutbox` holds events and sends them in order, one request at a time, in batches of up to 50. It knows nothing about React or the camera, so its rules are unit tested with a fake `send`:

| Server answer | Outbox does |
| --- | --- |
| 2xx | Forget the batch |
| 408, 429, 5xx, or no answer | **Keep it** and try again at the next flush |
| any other refusal (404, 409, 422) | **Drop it**: the server will never accept it |

An offline laptop cannot grow the queue without end: it holds at most 300 events, the same number the server accepts, and keeps the earliest. The monitor sends every 10 seconds, and once more as the page closes, using `fetch(..., { keepalive: true })` so the request can finish while the tab is going away. That is why the endpoint is a Route Handler and not a Server Action.

**Delivery is at least once.** If the answer to a batch is lost, the batch is sent again and an event can be stored twice. That is accepted on purpose: the report adds points up in coarse bands, so a repeat nudges a number and never decides anything. Exactly-once delivery would need an event id and a unique index, which is more machinery than a signal for a human deserves.

**Submitting.** Before the answers are sent, the room calls `finish()`: it closes the open spans, sends what is queued (waiting at most 3 seconds, so a slow network cannot hold up the submit) and then **pauses** the monitor. Whatever happens while the report is being written (the grading overlay, a tab switch to check email) is not the candidate's to answer for. If the submit fails and the candidate stays in the room, `resume()` starts the monitor again.

### 3.4 What the server does with a batch (`ingest.js`, `services/integrity.js`)

Anyone can open the browser's developer tools and send whatever they like, so every decision is made on the server:

1. **Shape** (`validations/integrity.js`): `z.strictObject`, so an unknown key is refused rather than ignored. No field can carry free text, an image or video. 1 to 50 events per request.
2. **Ownership and state** (`services/integrity.js`): the interview must be the caller's (otherwise 404), an `ASSESSMENT`, and `IN_PROGRESS`. After a submit the record is **frozen**: nothing can be added to a finished report.
3. **Clock** (`ingestEvents`): the browser says what time it thought it was when it sent the batch (`sentAtMs`). The difference from the server's clock is the offset, and every event is moved by it, so a laptop that is five minutes fast still reports correctly.
4. **Window**: an event must start no more than 60 s before the session began and end no more than 60 s after the server received the batch. Anything else is counted as `dropped`.
5. **Limits**: 300 events per interview. When a batch only partly fits, what fits is stored and the rest is counted as dropped; the batch is not refused.
6. **Tidying**: `PASTE` and `CAMERA_OFF` happen at one moment, so their duration is stored as 0 whatever was claimed. A `questionId` is kept only if it is a question of this interview. `detail` is kept only for a paste, and only as `{ chars }`.

`ingestEvents` is a pure function with its own unit tests; the service around it does only what needs the database.

### 3.5 What the database holds

Migration `20261112000000_integrity_monitoring` adds:

- Enums `InterviewMode` and `IntegrityEventType`. `tests/integrity-enums.test.js` compares them with the lists in the code, so the two cannot drift apart.
- `Interview.mode` (default `PRACTICE`) and `Interview.monitoringConsentAt` (`timestamptz(3)`), the moment the consent was given by the server's clock.
- Table `IntegrityEvent`: `id`, `interviewId`, `type`, `questionId?`, `startedAt`, `durationMs` (default 0), `detail` (JSON, optional), `createdAt`. An index on `(interviewId, startedAt)` serves the report's timeline, and the foreign key is `ON DELETE CASCADE`, so deleting a user deletes their events.
- Three hand-written `CHECK` constraints, because Prisma cannot express them: `Interview_assessment_requires_consent_check` (an assessment must have a consent time), `IntegrityEvent_durationMs_check` (no negative durations) and `IntegrityEvent_detail_only_chars_check` (`detail` may hold nothing but a numeric `chars`). They hold even if a bug in the application, or a person with database access, tries to store something else. The integration tests try each and expect a refusal.

There is **no column for video, images or text**. That is how "we never store your video or what you pasted" is enforced rather than promised.

### 3.6 The report (`summary.js`, `integrity-card.jsx`)

`summarizeIntegrity` turns the stored events into a level, a one-line headline, a count per kind and a timeline (time since the interview started, the question number, how long, and for a paste how many characters). It is pure and deterministic. The report shows it in a "Presence and focus" section for an assessment and **not at all** for a practice interview (`integrity` is `null`, not an empty summary). The card says at the top that these are "signals for a person to review, not proof of anything", names the usual causes of false alarms, and says at the bottom that the section "never changes your score". That last sentence is true because nothing in `lib/ai` or `lib/services/session.js` reads the events.

## 4. Privacy

| Question | Answer |
| --- | --- |
| Is video recorded or uploaded? | No. The picture is analysed frame by frame on the device and discarded. There is no upload code, no column to hold it, and `getUserMedia` is called with `audio: false`. |
| What is stored? | Event type, start time, duration, the question that was showing, and a paste's length. |
| What is *not* stored? | Frames, images, audio, the pasted text. (The text is read in the browser only to count its characters.) |
| Does anything leave the browser besides events? | The browser downloads the face model (about 230 KB) from Google's `storage.googleapis.com` the first time, like any file from a CDN. Set `NEXT_PUBLIC_FACE_MODEL_URL` to serve it yourself. The WebAssembly runtime is served from this app's own origin. |
| Is consent recorded? | Yes: `monitoringConsentAt`, by the server's clock. Enforced in the form, in the Zod schema, in the service, and by a `CHECK` constraint. |
| What if the candidate refuses the camera? | They can still take the interview. The panel says only focus checks run, and a `CAMERA_OFF` event is noted. |
| Does the camera stop? | Yes. Every timer, listener and camera track is released when the room closes, so the camera light goes out when the session ends. |
| Can events be deleted? | Only together with the user: the foreign keys cascade (`ON DELETE CASCADE`), so removing a user removes their interviews and events. The app has no delete-account screen yet, so today that is done in the database. |

This is a coursework prototype. Before using anything like it with real candidates, check the rules that apply where you are (for example data-protection law) and ask someone qualified.

## 5. The trust model

**The browser is the sensor, and the browser belongs to the candidate.** That sets what this can and cannot tell anyone:

- A determined person can use a second device, point a virtual camera at the interview, edit the page's JavaScript, or simply block the requests. The server can check that what it receives is well-formed and plausible; it cannot check that it is true. It also cannot tell "no events because nothing happened" from "no events because the monitor was blocked".
- An event is therefore *what the candidate's own browser reported*, and the absence of events is not evidence of honesty.
- A flag is not evidence of cheating either. Glasses, lighting, a second monitor used for the question itself, a person walking behind the candidate, a notification that steals focus and an ordinary webcam all cause false alarms.
- Face detectors are not equally accurate across faces, lighting and cameras, and this project has not measured it. That is a further reason a flag is only ever a reason for a person to look.

What the design does about it: it makes no claim of proof, says so in the report, never lets a flag change a score, asks for consent, shows the candidate everything it sees, and leaves the judgement to a human.

## 6. Setup and tuning

- **Install.** `npm install` runs `postinstall`, which also runs `scripts/copy-mediapipe-wasm.mjs`: it copies MediaPipe's WebAssembly files from `node_modules/@mediapipe/tasks-vision/wasm` to `public/mediapipe/wasm` (git-ignored), so they are served from this app's own origin, at the same version as the JavaScript. If the package is missing it only warns, and the camera check reports "camera not available". `src/proxy.js` excludes `/mediapipe/` from its matcher so those large static files do not pass through it.
- **Environment.** `NEXT_PUBLIC_FACE_MODEL_URL` (optional) points at a copy of the model in `public/`. It is a `NEXT_PUBLIC` value, so it is read at build time.
- **Camera permission.** `next.config.mjs` sends `Permissions-Policy: camera=()` on every page and `camera=(self)` on `/interviews/:id/session` only. A later matching header rule overrides an earlier one in Next.js, and `tests/security-headers.test.js` checks the result.
- **Content-Security-Policy.** None is set yet. If one is added, it must allow `wasm-unsafe-eval`, `https://storage.googleapis.com` for the model, and workers and `blob:`.
- **Browsers.** The camera needs a secure context (HTTPS, or `localhost`) and WebAssembly. The detector tries the GPU and falls back to the CPU, which is plenty at five frames a second.
- **Tuning.** Change a number in `INTEGRITY_RULES`, then run `npm test`. Do not tune from a hunch: record real sessions first (see Known limits).

## 7. Try it

1. Run the app (`npm run dev`), sign in, and open **New interview**. Choose a time, then **Assessment**. Read the list, tick the consent box, and notice that without the tick the form refuses and says why.
2. With `DEMO_MODE=true` the room opens at once. Open it, press **Start the interview**, and allow the camera when the browser asks.
3. Watch the panel: it names what it sees. Turn your head away for four seconds, cover the camera, or let a second person into the picture. Switch to another tab for a few seconds. Paste 40 or more characters into the answer. The counter on the right goes up as each flag is recorded (a long condition is recorded when it ends).
4. Submit. The report has a **Presence and focus** section with the timeline, and the score is exactly what it would be without it.
5. Open a **Practice** interview's report: there is no such section.

**Showing that the server does not trust the browser** (bash; fill in the cookie and an assessment's id, as in the curl section of [API.md](API.md#trying-it-with-curl)):

```bash
NOW=$(node -e "console.log(Date.now())")
# A paste that tries to smuggle the text along: refused, 422, nothing stored.
curl -s -X POST -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d "{\"sentAtMs\":$NOW,\"events\":[{\"type\":\"PASTE\",\"startedAtMs\":$NOW,\"durationMs\":0,\"questionId\":null,\"detail\":{\"chars\":5,\"text\":\"my answer\"}}]}" \
  $BASE/api/interviews/INTERVIEW_ID/integrity
# A well-formed batch sent to a practice interview instead: 409, "This interview is not being monitored."
```

## 8. Where the code is

| File | Job |
| --- | --- |
| `lib/integrity/constants.js` | The vocabulary: modes, event types, labels, the disclaimer, `INTEGRITY_RULES` |
| `lib/integrity/head-pose.js` | The head-turn estimate |
| `lib/integrity/tracker.js` | `SpanTracker` and `IntegrityTracker`: observations in, events out |
| `lib/integrity/face-source.js`, `mediapipe-face-source.js` | The detector interface, and the one file that knows about MediaPipe (loaded only when an assessment starts, so practice interviews never download it) |
| `lib/integrity/outbox.js` | The browser's queue and `postBatchTo` |
| `lib/integrity/ingest.js` | The server's checks, as a pure function |
| `lib/integrity/summary.js` | Points, levels and the timeline for the report |
| `lib/integrity/copy.js` | The words the candidate reads, in one place |
| `lib/validations/integrity.js`, `lib/validations/booking.js` | The strict schemas; the consent rule |
| `lib/services/integrity.js`, `app/api/interviews/[id]/integrity/route.js` | Ownership, state, limits, storage |
| `components/interview/use-integrity-monitor.js` | The hook that runs it all in the room |
| `components/interview/integrity-panel.jsx`, `assessment-notice.jsx` | What the candidate sees |
| `components/feedback/integrity-card.jsx` | The report section |
| `prisma/migrations/20261112000000_integrity_monitoring` | Enums, table, constraints |
| `scripts/copy-mediapipe-wasm.mjs` | Puts the WebAssembly files where the app can serve them |

## 9. Decisions and trade-offs

- **Detect in the browser, not on the server.** Sending video to a server would need bandwidth, storage and a much heavier privacy promise. On-device detection means the strongest promise ("your video never leaves your computer") is also the true one. *Cost:* the server has to take the browser's word, which is why the report says "signal".
- **Store facts, never media.** A table with no column for video or text cannot leak either. *Cost:* a reviewer sees "face out of frame for 12 s at 4:10", not a clip, and cannot judge what was happening.
- **A plain geometric yaw, not a head-pose model.** It needs only the six keypoints the detector already returns and costs nothing at five frames a second. *Cost:* it is crude and uncalibrated.
- **Spans with a minimum length and a grace period.** Detectors flicker and people look at their keyboards. *Cost:* a real, short absence is invisible by design.
- **At-least-once delivery.** Simple, and harmless for a coarse score. *Cost:* a rare duplicate.
- **A Route Handler, not a Server Action, for the events.** The browser sends from a timer and with `keepalive` on page close, and needs a readable answer. *Cost:* a Route Handler does not get a Server Action's built-in Origin check, so it relies on the `withApiParams` wrapper for that, and on a rate limit of its own.
- **Consent enforced at four levels.** The form asks, Zod refuses, the service refuses again and records the time, a `CHECK` constraint backs it. *Cost:* four places to keep in step, which `tests/integration/integrity.test.js` covers.
- **The monitor pauses after submit.** What happens while the report is being written is not the candidate's to answer for. *Cost:* a little state (`finish` and `resume`).
- **The flags never touch the score.** A noisy heuristic must not decide an outcome. *Cost:* an organisation that wants a consequence has to apply it itself, with a person in the loop.

## Known limits

1. **The thresholds are not calibrated.** 0.35 for a head turn, and 3, 2 and 4 seconds for the spans, were chosen by reasoning. They have not been tested on real faces, glasses, lighting or webcams. Calibrating them means recording a range of sessions and checking the false-alarm and miss rates.
2. **No automated test shows the detector a real face.** `e2e/assessment.spec.js` uses Chromium's synthetic camera, whose picture has no face, and asserts on consent, the paste and the report, not on what the detector sees. The rules around the detector (the head-turn estimate, how long a condition must last, the outbox, the server's checks) are unit tested with made-up observations.
3. **One detector, one sensor.** It does not hear (no audio), see the screen, or know about a phone, a second computer or a person off camera.
4. **Multiple faces means multiple detected faces.** A face turned away, small, or behind another can be missed.
5. **Blocking the requests leaves a gap**, and the server cannot tell it from a clean session.
6. **No reviewer's view.** The report is shown to the candidate. An instructor or admin console that lists flags across candidates belongs to a later step.
7. **No appeal or retake workflow, no retention policy and no delete-account screen.** The foreign keys cascade, so removing a user in the database removes their events, but a candidate cannot do it themselves yet.
8. **The face model is fetched from Google by default.** Self-hosting it is one environment variable.
9. **Rate limiting is per server instance**, like the rest of the app (see [ARCHITECTURE.md](ARCHITECTURE.md#known-limits)).
10. **The 300-event cap is approximate under concurrency.** The service reads how many events exist and then inserts, with no lock, so batches that arrive at the same moment can overshoot it slightly (the rate limit bounds how far). It is an abuse guard, not a quota. An exact cap would need a `SERIALIZABLE` transaction with a retry, as booking uses; a lost or doubled flag is not worth that cost.
