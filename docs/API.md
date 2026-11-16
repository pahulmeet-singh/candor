# API reference

Candor has two ways in for code that changes or reads data: **Route Handlers** (HTTP endpoints under `/api`) and **Server Actions** (functions the UI calls directly). Both end up in the same service functions, so they enforce the same rules. [ARCHITECTURE.md](ARCHITECTURE.md#5-server-actions-or-route-handlers) explains when each is used.

- [Conventions](#conventions)
- [Error codes](#error-codes)
- [Route Handlers](#route-handlers)
- [Server Actions](#server-actions)
- [Trying it with curl](#trying-it-with-curl)

---

## Conventions

| Topic | Rule |
| --- | --- |
| **Format** | JSON requests (`Content-Type: application/json`) and JSON responses. Bodies over 1 MB are refused with 422. |
| **Authentication** | The Auth.js session cookie (`authjs.session-token`, or `__Secure-authjs.session-token` over HTTPS). Every endpoint except `/api/health`, `/api/vitals` and `/api/auth/*` returns **401** without one. |
| **Ownership** | Every query is scoped to the signed-in user. Someone else's record is **404**, the same as one that does not exist, so ids cannot be probed. |
| **Origin check** | `POST`, `PATCH` and `DELETE` must come from the same origin. A request with a foreign `Origin` header gets **403**. Requests with no `Origin` header (curl, server-to-server) pass. |
| **Caching** | Per-user responses carry `Cache-Control: private, no-store`. |
| **Request id** | Every response has an `x-request-id` header. It also appears in error bodies and in the server log line for the request. A caller may send its own. |
| **Rate limits** | Per user, sliding window, in memory (per server instance). Exceeding one returns **429** with a message that says how long to wait. |
| **Dates** | ISO 8601 strings. Slot times are instants (`2026-11-03T04:30:00.000Z` is 10:00 in IST). |
| **Ids** | Opaque strings (cuid). Path ids are validated as 8 to 64 characters of `A-Z a-z 0-9 _ -` before any query runs. |

### Error envelope

Every failure from a Route Handler has the same body:

```json
{
  "error": {
    "code": "SLOT_FULL",
    "message": "That slot just filled up. Pick another time.",
    "fieldErrors": { "date": ["Choose a date within the next 13 days."] },
    "requestId": "7c1d6f0e-5c1b-4a45-9a52-0f1f5b7b2c11"
  }
}
```

`fieldErrors` appears for validation failures. `message` is always safe to show to a user; unexpected server errors are reported as a generic message and logged in full.

## Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No valid session, or wrong credentials. |
| `FORBIDDEN` | 403 | Signed in but not allowed (not an admin, or a cross-site write). |
| `NOT_FOUND` | 404 | No such record, or it belongs to someone else. |
| `VALIDATION` | 422 | Input failed its Zod schema; see `fieldErrors`. |
| `SLOT_INVALID` | 422 | The time is not a bookable slot (off the grid, too soon, too far ahead). |
| `FILE_INVALID` | 422 | The upload is not an acceptable PDF. |
| `CONFLICT` | 409 | Duplicate (email already registered, slot already booked by you) or heavy contention. |
| `SLOT_FULL` | 409 | All three seats taken. |
| `LIMIT_REACHED` | 409 | Five upcoming bookings already held. |
| `INVALID_STATE` | 409 | The interview is not in a state that allows this (too early, missed, cancelled, completed). |
| `RATE_LIMITED` | 429 | Too many requests from this user or address. |
| `AI_RATE_LIMITED` | 429 | The AI provider is rate limiting us and no fallback was possible. |
| `AI_BAD_OUTPUT` | 502 | The AI reply could not be used after one repair attempt and no fallback was possible. |
| `STORAGE_ERROR` | 502 | Supabase Storage is unreachable or not configured. |
| `AI_UNAVAILABLE` | 503 | The AI provider is down, timed out or misconfigured and no fallback was possible. |
| `INTERNAL` | 500 | Anything unexpected. |

With `AI_FALLBACK=true` (the default) the three `AI_*` errors do not reach the client: the offline evaluator answers instead.

---

## Route Handlers

All of these set `dynamic = "force-dynamic"` (never cached) except where noted. HTTP methods demonstrated: **GET, POST, PATCH, DELETE**. Dynamic segments demonstrated: `[id]`, and the catch-all `[...nextauth]`.

| Method | Path | Purpose | Auth | Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/slots?date=YYYY-MM-DD` | The day's 16 slots and how full each is | user | |
| `GET` | `/api/interviews?tab=&page=` | The caller's bookings, one tab at a time | user | |
| `POST` | `/api/interviews` | Book a slot | user | 10 / min |
| `GET` | `/api/interviews/:id` | One booking, with its transcript | user | |
| `PATCH` | `/api/interviews/:id` | Autosave one answer | user | 120 / min |
| `DELETE` | `/api/interviews/:id` | Cancel a booking | user | 20 / min |
| `POST` | `/api/interviews/:id/questions` | Start the session and generate its questions | user | 8 / min |
| `POST` | `/api/interviews/:id/integrity` | Send the integrity monitor's events (assessments only) | user | 30 / min |
| `POST` | `/api/interviews/:id/evaluate` | Submit answers and create the report | user | 5 / 10 min |
| `GET` | `/api/feedback/:id` | One full report | user | |
| `GET` | `/api/resume/:id/download` | 302 to a 60-second signed download link | user | |
| `GET` | `/api/admin/stats` | Platform totals | admin | |
| `GET` | `/api/health` | Liveness probe (Edge runtime) | none | |
| `POST` | `/api/vitals` | Core Web Vitals sink | none | 60 / min / IP |
| `GET`, `POST` | `/api/auth/*` | Auth.js: sign-in, callbacks, session, CSRF | n/a | |

`:id` is the interview id, except in two places: `/api/feedback/:id` takes the **report id** (the `feedbackId` returned by `/evaluate` and shown on an interview), and `/api/resume/:id/download` takes the **résumé id**.

### `GET /api/slots`

Query: `date` (optional, `YYYY-MM-DD`, an IST calendar date; defaults to today). Must fall within today and the next 13 days, otherwise 422.

```json
{
  "date": "2026-11-03",
  "activeBookings": 2,
  "maxActiveBookings": 5,
  "slots": [
    { "start": "2026-11-03T04:30:00.000Z", "end": "2026-11-03T05:00:00.000Z", "booked": 1, "capacity": 3, "state": "open" },
    { "start": "2026-11-03T05:00:00.000Z", "end": "2026-11-03T05:30:00.000Z", "booked": 3, "capacity": 3, "state": "full" }
  ]
}
```

`state` is one of `open`, `full`, `mine` (you already hold a seat), or `closed` (in the past, less than 30 minutes away, or beyond the horizon). Sixteen slots are returned per day; two are shown above.

### `GET /api/interviews`

Query: `tab` = `upcoming` (default) | `past` | `cancelled`; `page` = 1 to 500 (default 1). Bad values fall back to the defaults instead of failing. Eight items per page.

```json
{
  "tab": "upcoming",
  "page": 1,
  "pageSize": 8,
  "total": 2,
  "totalPages": 1,
  "counts": { "upcoming": 2, "past": 6, "cancelled": 1 },
  "items": [
    {
      "id": "cm3k8q2x40001qz0h9d7l1a2b",
      "category": "DSA",
      "difficulty": "INTERMEDIATE",
      "mode": "PRACTICE",
      "scheduledAt": "2026-11-02T05:00:00.000Z",
      "durationMin": 30,
      "status": "SCHEDULED",
      "displayStatus": "SCHEDULED",
      "startedAt": null,
      "completedAt": null,
      "usesResume": false,
      "feedbackId": null,
      "overallScore": null,
      "createdAt": "2026-10-30T09:12:44.000Z"
    }
  ]
}
```

`status` is what is stored; `displayStatus` additionally has `MISSED` for a scheduled slot that has already passed.

### `POST /api/interviews`

```json
{
  "category": "FULLSTACK_NEXT",
  "difficulty": "INTERMEDIATE",
  "scheduledAt": "2026-11-03T05:30:00.000Z",
  "useResume": false,
  "mode": "PRACTICE",
  "monitoringConsent": false
}
```

| Field | Rule |
| --- | --- |
| `category` | `FRONTEND`, `BACKEND`, `DSA`, `SYSTEM_DESIGN`, `BEHAVIOURAL`, `FULLSTACK_NEXT` |
| `difficulty` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` |
| `scheduledAt` | ISO instant with offset; must be the start of one of the day's slots, at least 30 minutes away and within 14 days |
| `useResume` | optional boolean, default `false`; `true` requires an uploaded résumé |
| `mode` | optional, `PRACTICE` (default: private, nothing is watched) or `ASSESSMENT` (camera and focus checks; see [INTEGRITY.md](INTEGRITY.md)) |
| `monitoringConsent` | optional boolean, default `false`. Must be `true` when `mode` is `ASSESSMENT`, otherwise 422 `VALIDATION` with a message under `fieldErrors.monitoringConsent`. The server stores the time it was given (`Interview.monitoringConsentAt`). Ignored for `PRACTICE`. |

**201 Created**, `Location: /api/interviews/:id`, body: the `InterviewDTO` shown above. Errors: 401, 403, 409 `SLOT_FULL` / `LIMIT_REACHED` / `CONFLICT`, 422 `VALIDATION` / `SLOT_INVALID`, 429.

Booking runs in a serializable transaction and is retried up to three times on a serialization failure; see [the booking section](ARCHITECTURE.md#6-booking-without-overbooking).

### `GET /api/interviews/:id`

Returns the `InterviewDTO` plus `transcript` (`null` until the session starts):

```json
{
  "id": "cm3k8q2x40001qz0h9d7l1a2b",
  "status": "IN_PROGRESS",
  "transcript": {
    "questions": [{ "id": "q1", "text": "What does the CSS box model describe?", "topic": "CSS layout" }],
    "answers": { "q1": { "text": "Content, padding, border and margin.", "savedAt": "2026-11-02T05:03:10.000Z" } },
    "source": { "provider": "gemini", "model": "gemini-3.8-flash", "generatedAt": "2026-11-02T05:00:41.000Z", "usedResume": false }
  }
}
```

(Other `InterviewDTO` fields omitted for brevity.) 404 if it is not yours.

### `PATCH /api/interviews/:id`

Saves one answer. Body: `{ "questionId": "q1", "text": "..." }`; `text` up to 4000 characters. Response: `{ "savedAt": "2026-11-02T05:03:10.000Z" }`. 409 `INVALID_STATE` unless the interview is `IN_PROGRESS`; 422 if `questionId` is not one of this interview's questions. The write is a single atomic `jsonb_set`, so saving one answer never disturbs another.

### `DELETE /api/interviews/:id`

Cancels a booking that has not started and returns the updated `InterviewDTO` (`status: "CANCELLED"`). The row is kept so history stays honest. 409 `INVALID_STATE` if it was already cancelled or has started.

### `POST /api/interviews/:id/questions`

Starts the session: checks the room is open (10 minutes before the slot until it ends, or any time with `DEMO_MODE`), generates five questions (Gemini, tailored to the résumé when the booking asked for it, otherwise the offline bank), stores them and moves the interview to `IN_PROGRESS`. No body. Returns the interview with its `transcript`. **Calling it again returns the same questions**, so a reload never regenerates them. `maxDuration = 60`.

### `POST /api/interviews/:id/integrity`

Called by the browser while an **assessment** is running (never for a practice interview). The integrity monitor collects facts about the session (a face out of frame, a tab that was left, a large paste) and sends them in small batches, every ten seconds and once more when the page closes.

```json
{
  "sentAtMs": 1793598600000,
  "events": [
    { "type": "FACE_MISSING", "startedAtMs": 1793598571000, "durationMs": 4200, "questionId": "q2" },
    { "type": "PASTE", "startedAtMs": 1793598590000, "durationMs": 0, "questionId": "q2", "detail": { "chars": 312 } }
  ]
}
```

| Field | Rule |
| --- | --- |
| `sentAtMs` | The browser's own clock (epoch ms) when it sent the batch. The server compares it with its clock and moves every event by the difference, so a laptop with the wrong time still reports correctly. |
| `events` | 1 to 50 per request. |
| `type` | `FACE_MISSING`, `MULTIPLE_FACES`, `LOOKING_AWAY`, `TAB_HIDDEN`, `FOCUS_LOST`, `PASTE`, `CAMERA_OFF` |
| `startedAtMs` | Epoch ms on the browser's clock. |
| `durationMs` | 0 to 3,600,000. `PASTE` and `CAMERA_OFF` happen at one moment, so the server stores 0 for them whatever is sent. |
| `questionId` | The question on screen when it began, or `null`. Kept only if it is a question of this interview. |
| `detail` | `{ "chars": n }`, for a `PASTE` only: how long the pasted text was. Dropped for every other type. The text itself is never sent. |

Unknown keys are refused (422), so there is nowhere to put free text, an image or a frame of video.

```json
{ "saved": 2, "dropped": 0 }
```

`dropped` counts events the server refused: outside the session's time window (the session start minus 60 s, up to now plus 60 s) or over the limit of **300 events per interview**. A batch that is partly refused is still accepted; the rest is stored. Errors: 401; 404 if the interview is not yours; 409 `INVALID_STATE` if it is a practice interview or is not `IN_PROGRESS` (a finished report cannot be added to); 422; 429.

**Delivery is at least once.** If a response is lost the browser sends the batch again, so an event can be stored twice. The report only adds points up in coarse bands, so a repeat nudges a number and never decides anything.

### `POST /api/interviews/:id/evaluate`

Body: `{ "answers": { "q1": "...", "q2": "..." } }`, optional. It carries what is on screen so the last keystrokes are not lost. Ids that are not questions of this interview are ignored.

```json
{ "feedbackId": "cm3kb7n1k0007qz0hzx2c9d4e", "overallScore": 72 }
```

Grades the session, stores the report and completes the interview. **Idempotent:** submitting again returns the existing report. 409 `INVALID_STATE` if the session was never started. `maxDuration = 60`.

### `GET /api/feedback/:id`

One report: the scores, the per-question annotations and model answers, and the transcript it was graded from.

```json
{
  "id": "cm3kb7n1k0007qz0hzx2c9d4e",
  "interviewId": "cm3k8q2x40001qz0h9d7l1a2b",
  "overallScore": 72,
  "readiness": "ON_TRACK",
  "model": "gemini-3.8-flash",
  "createdAt": "2026-11-02T05:31:02.000Z",
  "evaluation": {
    "summary": "...",
    "competencies": [{ "key": "technical_accuracy", "score": 7, "note": "..." }],
    "questions": [
      {
        "questionId": "q1",
        "score": 8,
        "summary": "...",
        "annotations": [{ "kind": "strength", "quote": "Content, padding, border and margin", "note": "..." }],
        "modelAnswer": "..."
      }
    ],
    "topStrengths": ["..."],
    "topImprovements": ["..."],
    "nextSteps": ["..."]
  },
  "transcript": { "questions": [], "answers": {}, "source": {} },
  "integrity": null,
  "interview": { "id": "...", "category": "FRONTEND", "difficulty": "INTERMEDIATE", "mode": "PRACTICE", "scheduledAt": "...", "startedAt": "...", "completedAt": "...", "durationMin": 30 }
}
```

`integrity` is `null` for a practice interview, which is never watched. For an assessment it is a summary of the stored events:

```json
{
  "level": "NOTED",
  "points": 2,
  "headline": "A few interruptions were noted.",
  "totalEvents": 1,
  "byType": [{ "type": "PASTE", "label": "Pasted text into an answer", "count": 1, "totalMs": 0 }],
  "timeline": [
    { "id": "cm3k9d0aa0003qz0h1b2c3d4e", "type": "PASTE", "label": "Pasted text into an answer", "offsetMs": 312000, "durationMs": 0, "questionNumber": 2, "note": "120 characters" }
  ]
}
```

`level` is `CLEAR` (0 points), `NOTED` (1 to 5) or `REVIEW` (6 or more). It is information for a person to read and **never changes `overallScore`**: nothing in the evaluation reads these events.

`overallScore` (0 to 100) is computed by the server from the question scores. `readiness` is `NEEDS_WORK` (below 50), `ON_TRACK` (below 75) or `INTERVIEW_READY`. The five competency keys are always `technical_accuracy`, `depth`, `problem_solving`, `communication` and `structure` (`src/lib/constants/competencies.js`), each scored 0 to 10, so reports are comparable between sessions.

### `GET /api/resume/:id/download`

**302** to a Supabase signed URL valid for 60 seconds, served as a download with the original file name. 404 if the résumé is not yours; 502 `STORAGE_ERROR` if storage is unreachable.

### `GET /api/admin/stats`

```json
{
  "users": 3, "admins": 1, "interviews": 9, "reports": 9, "resumes": 0,
  "averageScore": 61,
  "byCategory": [{ "category": "FRONTEND", "interviews": 3 }]
}
```

401 when signed out, **403** for a signed-in non-admin. The role is re-read from the database on every call.

### `GET /api/health`

```json
{ "status": "ok", "service": "candor", "runtime": "edge", "time": "2026-11-02T05:00:00.000Z" }
```

Runs on the **Edge runtime**. It does not touch the database; it only says the deployment is serving requests.

### `POST /api/vitals`

Receives `{ "name": "LCP", "value": 1234.5, "rating": "good", "path": "/dashboard" }` from the browser's `sendBeacon`, writes one log line, answers **204**. Only `CLS`, `FCP`, `INP`, `LCP` and `TTFB` are accepted; other names and bodies over 2 KB are ignored (413 for oversize).

---

## Server Actions

Called by the UI, not meant for external use (each is a POST to a generated URL that Next.js protects with an Origin check). Each one re-authenticates and re-validates its input, then returns an `ActionResult`:

```js
// success: `data` is what the action returns; `message` is optional text for a toast
{ ok: true, data: { /* ... */ }, message: "Saved." }

// failure: `code` is one of the error codes below; `fieldErrors` maps a form field to its messages
{ ok: false, error: "Choose a later time.", code: "VALIDATION", fieldErrors: { scheduledAt: ["Choose a later time."] } }
```

| Action | File | Input | On success | Revalidates | Limit |
| --- | --- | --- | --- | --- | --- |
| `loginAction` | `actions/auth.js` | form: `email`, `password`, `callbackUrl?` | redirects to a safe `callbackUrl` or `/dashboard` | | 8 / 15 min per email, 20 / 15 min per IP |
| `registerAction` | `actions/auth.js` | form: `name`, `email`, `password` | creates the user, signs in, redirects to `/dashboard` | | 6 / hour per IP |
| `googleSignInAction` | `actions/auth.js` | form: `callbackUrl?` | starts the Google OAuth flow | | |
| `logoutAction` | `actions/auth.js` | none | ends the session, redirects to `/` | | |
| `bookInterviewAction` | `actions/interviews.js` | object, same as `POST /api/interviews` | `InterviewDTO` | `/interviews`, `/dashboard` | 10 / min |
| `cancelInterviewAction` | `actions/interviews.js` | interview id | `InterviewDTO` | `/interviews`, `/interviews/:id`, `/dashboard` | 20 / min |
| `saveAnswerAction` | `actions/interviews.js` | `{ interviewId, questionId, text }` | `{ savedAt }` | none (the room holds its own state) | 120 / min |
| `uploadResumeAction` | `actions/resume.js` | form: `file` (PDF, up to 4 MB) | `ResumeDTO` | `/resume`, `/interviews/new` | 6 / min |
| `deleteResumeAction` | `actions/resume.js` | none | | `/resume`, `/interviews/new` | 6 / min |
| `setRoleAction` | `actions/admin.js` | form: `userId`, `role` | `{ id, role }` | `/admin` | admin only |

Notes:

- `loginAction` and `registerAction` are used with `useActionState`, so their first argument is the previous state. Failures return `{ ok: false, error, fieldErrors }` and the form shows them next to the inputs; success calls `redirect()`.
- `uploadResumeAction` is the course's required Server Action file upload: it validates type, size and the `%PDF-` signature on the server, stores the object in a private Supabase bucket and records its path with Prisma.
- `setRoleAction` re-reads the caller's role from the database and refuses to remove the last admin.

---

## Trying it with curl

The simplest way to authenticate from the command line is to sign in with the browser and reuse its cookie.

1. Sign in at `http://localhost:3000/login` (for example as `student@candor.test`).
2. In the browser's developer tools, open Application (or Storage), Cookies, and copy the value of `authjs.session-token`.
3. Use it:

```bash
export BASE=http://localhost:3000
export COOKIE='authjs.session-token=PASTE_VALUE_HERE'

# Public
curl -s $BASE/api/health

# Today's slots
curl -s -H "Cookie: $COOKIE" "$BASE/api/slots?date=2026-11-03"

# Book one
curl -s -X POST -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"category":"BACKEND","difficulty":"BEGINNER","scheduledAt":"2026-11-03T05:30:00.000Z"}' \
  $BASE/api/interviews

# List, then cancel
curl -s -H "Cookie: $COOKIE" "$BASE/api/interviews?tab=upcoming"
curl -s -X DELETE -H "Cookie: $COOKIE" $BASE/api/interviews/INTERVIEW_ID

# What a refusal looks like (not an admin)
curl -si -H "Cookie: $COOKIE" $BASE/api/admin/stats | head -20
```

Over HTTPS the cookie is named `__Secure-authjs.session-token`.
