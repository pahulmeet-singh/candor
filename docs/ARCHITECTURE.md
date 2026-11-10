# Architecture

This document explains how Candor is put together and, more importantly, **why**. Each section ends with the trade-off that was accepted, because that is what a viva examiner will ask about.

- [1. The shape of the system](#1-the-shape-of-the-system)
- [2. Layers and the dependency rule](#2-layers-and-the-dependency-rule)
- [3. Data model](#3-data-model)
- [4. Rendering and caching](#4-rendering-and-caching)
- [5. Server Actions or Route Handlers?](#5-server-actions-or-route-handlers)
- [6. Booking without overbooking](#6-booking-without-overbooking)
- [7. The life of an interview](#7-the-life-of-an-interview)
- [8. The AI pipeline](#8-the-ai-pipeline)
- [9. Authentication and authorization](#9-authentication-and-authorization)
- [10. Résumé upload](#10-résumé-upload)
- [11. Errors, logging and monitoring](#11-errors-logging-and-monitoring)
- [12. Security checklist](#12-security-checklist)
- [13. Front-end structure](#13-front-end-structure)
- [14. Testing](#14-testing)
- [Known limits](#known-limits)

---

## 1. The shape of the system

```
                                   ┌──────────────────────────────────────────────┐
 Browser ──── request ───────────▶ │ proxy.ts  (cookie present? request id)       │
   ▲                               └───────────────┬──────────────────────────────┘
   │                                               │
   │      ┌────────────────────────────────────────┼─────────────────────────────┐
   │      │ Server Components      Server Actions  │       Route Handlers         │
   │      │ (pages, layouts)       (mutations)     │       (REST + AI calls)      │
   │      └──────────┬─────────────────┬───────────┴───────────────┬──────────────┘
   │                 │ read            │ write                     │ read / write
   │                 ▼                 ▼                           ▼
   │      ┌────────────────┐   ┌─────────────────────────────────────────────────┐
   │      │ lib/data/*     │   │ lib/services/*   (rules, transactions)          │
   │      │ queries → DTOs │   └───────┬──────────────────┬──────────────┬───────┘
   │      └───────┬────────┘           │                  │              │
   │              ▼                    ▼                  ▼              ▼
   │        ┌──────────┐        ┌────────────┐     ┌────────────┐  ┌───────────┐
   └─ HTML/ │  Prisma  │        │  lib/ai/*  │     │  Supabase  │  │ Auth.js   │
     JSON   │ (pg)     │        │  Gemini or │     │  Storage   │  │ (JWT      │
            └────┬─────┘        │  offline   │     │  (private) │  │  cookie)  │
                 ▼              └────────────┘     └────────────┘  └───────────┘
          PostgreSQL (Supabase)
```

Three kinds of code can be reached from the browser, and they are kept thin:

| Entry point | Reached by | Job |
| --- | --- | --- |
| **Server Components** (`page.tsx`, `layout.tsx`) | Navigation | Check who is asking, read data through `lib/data`, render. |
| **Server Actions** (`src/actions`) | Forms and `startTransition` calls from our own UI | Mutations that refresh the page. |
| **Route Handlers** (`src/app/api`) | `fetch`, other clients | Reads that other clients may want, slow AI calls, anything that wants HTTP semantics. |

All three finish by calling the same **services** and **data** functions, so a rule is written once.

## 2. Layers and the dependency rule

```
app/ and actions/        thin: authenticate → validate (Zod) → call one service → revalidate
        │
        ▼
lib/services/            the rules: capacity, limits, state transitions, transactions
lib/data/                read queries, return DTOs (never Prisma rows)
        │
        ▼
lib/db.ts, lib/supabase/, lib/ai/        the outside world

lib/slots.ts, status.ts, scoring.ts, annotate.ts, transcript.ts    pure functions, no I/O
```

Imports only point downwards. Two consequences matter:

- **Pure logic is testable without a database.** Slot generation, the "can this interview start now?" rule, score maths and the answer highlighter are plain functions with unit tests. The services call them; so does the UI, which is why a button never offers something the server will refuse.
- **DTOs are the only thing that crosses to the browser.** `lib/data/mappers.ts` turns Prisma rows into plain objects with dates as ISO strings. Each query `select`s exactly the columns it needs, so `passwordHash` cannot appear in a response or a Client Component prop, even by mistake.

Cross-cutting helpers: `lib/errors.ts` (one error type), `lib/action.ts` and `lib/http.ts` (the two wrappers that turn errors into results), `lib/rate-limit.ts`, `lib/logger.ts`, `lib/env.ts` (typed, lazy environment access).

*Trade-off:* a service layer is more files than calling Prisma from the action. It pays for itself the first time a second entry point (`POST /api/interviews`) needs the same booking rules.

## 3. Data model

```
User 1───* Interview 1───0..1 Feedback
 │            *
 │            └──0..1 Resume
 ├──0..1 Resume
 ├──* Account        (Auth.js: linked Google accounts)
 └──* Session        (Auth.js: unused, JWT sessions are used)
VerificationToken    (Auth.js: unused here)
```

| Model | Notes |
| --- | --- |
| `User` | `email` is unique; `passwordHash` is null for Google accounts; `role` is `USER` or `ADMIN`. |
| `Interview` | One booked slot. `category`, `difficulty`, `scheduledAt` (UTC `timestamptz`), `status`, and a `transcript` JSON column holding the questions and the answers. |
| `Feedback` | One report per interview (`interviewId` is unique). `overallScore` is an `Int` column so it can be sorted and averaged in SQL; the rest of the report is `evaluation` JSON. |
| `Resume` | One per user (`userId` is unique). Stores the object path in the bucket, not the file. |
| `Account`, `Session`, `VerificationToken` | The tables the Auth.js Prisma adapter expects. |

Decisions worth defending:

- **JSON columns for `transcript` and `evaluation`.** They are always read and written as a whole document, never queried field by field, and their shape changes as prompts evolve. Zod schemas (`transcriptSchema`, `evaluationSchema`) validate them when written *and* when read, so a bad row is detected instead of crashing a page. The one hot field, the score, is a real column.
- **`timestamptz(3)` everywhere.** Slots are defined in IST but stored as instants; a database that is queried from a server in any time zone returns the same moments.
- **Indexes follow the queries.** `(userId, status, scheduledAt)` serves the "my interviews" tabs and the active-bookings count; `(scheduledAt, status)` serves "how many seats are taken in this day"; `Feedback(createdAt)` serves recent reports.
- **Cascades.** Deleting a user removes their interviews, reports and résumé row. Deleting a résumé sets `Interview.resumeId` to null instead of deleting the interview.
- **No stored "MISSED" status.** A scheduled interview whose slot has passed is *shown* as missed (`deriveDisplayStatus`). Deriving it means no cron job has to keep a column in sync.

*Trade-off:* JSON columns give up database-level constraints on the document. The Zod check on both sides is the replacement.

## 4. Rendering and caching

Every route has a rendering strategy chosen on purpose. The table in the README lists them; this is the reasoning.

**Static (SSG).** `/categories`, `/sample-report` and `/categories/[slug]` contain no per-user data, so they are built once at `next build` and served from the CDN. For the dynamic segment, `generateStaticParams` returns the six known slugs and `dynamicParams = false` makes every other slug a 404 without running any code. The page also emits `generateMetadata` and JSON-LD for SEO.

**Incremental Static Regeneration.** The landing page shows three public counters. They change slowly, so `export const revalidate = 600` serves the cached HTML and rebuilds it in the background at most every ten minutes. The counters are read through `unstable_cache` with the tag `public-stats`, and the evaluate Route Handler calls `revalidateTag("public-stats", "max")` after a report is saved, so the number moves immediately instead of waiting for the timer. If the database is unreachable the page still renders (`getPublicStats` returns `null`), which also lets `next build` succeed on a machine with no database.

**Server-side rendering.** Everything behind login depends on cookies, so it is rendered per request. Filters and pagination live in the URL (`?tab=past&page=2`), parsed by Zod, so a page is shareable and works without JavaScript.

**Parallel routes.** `/dashboard` is assembled from three slots, `@stats`, `@trend` and `@upcoming`. Each fetches its own data and has its own `loading.tsx`, so a slow trend query does not hold back the counters. Each slot also has a `default.tsx`, which is what Next renders for a slot on a URL it cannot match.

**Intercepting routes.** From the feedback list, a link to `/feedback/[id]` is intercepted by `@modal/(.)feedback/[id]` and the report opens as a dialog over the list. Opening the same URL directly, or refreshing, renders the full page. `@modal/default.tsx` returns `null` (no modal) and `@modal/[...catchAll]` closes the modal when the user navigates elsewhere.

**Client rendering.** Only where state lives in the browser: the booking form (day picker, slot grid), the interview room (typing, autosave, countdown), the optimistic cancel list, the resume dropzone and the auth forms. Everything else on those pages stays a Server Component.

**Code splitting and lazy loading.** The score trend chart is loaded with `next/dynamic`, so its JavaScript is a separate chunk that only the dashboard downloads. The user menu's avatar uses `next/image`.

**Edge runtime.** `/api/health` runs on the Edge runtime because it needs no database. Everything that uses Prisma stays on Node.js, since Edge functions cannot open TCP connections.

### Which cache is which

| Cache | What it holds | How it is refreshed here |
| --- | --- | --- |
| Full Route Cache | Rendered HTML of static and ISR pages | `revalidate = 600`; rebuilt on deploy |
| Data Cache | `unstable_cache` results | `revalidate: 600` or `revalidateTag(PUBLIC_STATS_TAG, "max")` |
| Router Cache (browser) | Visited pages for instant back/forward | `revalidatePath` inside Server Actions and handlers invalidates it for the affected paths |
| Request memoization | Duplicate reads inside one render | `getCurrentUser` uses `React.cache`, so a layout and a page share one session lookup |

After each mutation the code revalidates exactly the pages that show the changed data: booking refreshes `/interviews` and `/dashboard`, a new report also refreshes `/feedback` and the public-stats tag.

*Trade-off:* Next 16 also offers Cache Components (`"use cache"`) behind a flag. This project uses the stable `revalidate` / `unstable_cache` / `revalidateTag` model, which is the vocabulary the syllabus uses and does not need an experimental flag.

## 5. Server Actions or Route Handlers?

The rule that was applied, not a coin toss:

| Use a **Server Action** when | Use a **Route Handler** when |
| --- | --- |
| It is a mutation triggered by our own form or button | It is a read, or a call another client could make |
| The page should refresh afterwards | The caller wants JSON, a status code or a redirect |
| It should work as a progressively enhanced `<form>` | The call is slow and the client wants to `await` it with a progress state |

So:

- **Actions:** sign in, register, sign out, book, cancel, save an answer (autosave), upload and delete résumé, change a role. All of them return an `ActionResult<T>`, a plain `{ ok: true, data } | { ok: false, error, fieldErrors }` object, so forms render errors with no `try/catch`.
- **Handlers:** `GET /api/slots` (a Client Component asks each time the day changes), the interview and feedback REST endpoints, the résumé download redirect, the health probe, the vitals sink, and the two **AI** endpoints. The AI calls take seconds and the room wants a spinner and a result, which is a request/response shape, so they are handlers with `maxDuration = 60`.
- **The same rules behind both.** `bookInterviewAction` and `POST /api/interviews` call one `bookInterview` service; `saveAnswerAction` and `PATCH /api/interviews/:id` call one `saveAnswer`; cancelling works the same way. A REST client and the web UI can never disagree about capacity. The web UI uses the Server Action for booking, cancelling and autosave, and `fetch` for slots, starting and submitting; the REST twins exist for any other client and for the API section of the viva.

Every handler goes through `withApi` or `withApiParams` (`lib/http.ts`), which adds the request id, checks the `Origin` header on writes, converts any thrown `AppError` into `{ error: { code, message, fieldErrors, requestId } }` with the right HTTP status, and logs one line.

## 6. Booking without overbooking

A slot holds three people. The naive code is "count the bookings, and if fewer than three, insert". Two requests that run it at the same moment both count two, both insert, and the slot has four people. A `UNIQUE` constraint cannot express "at most three", so the database has to be told the check and the insert are one atomic decision.

`bookInterview` runs these steps inside **one `SERIALIZABLE` transaction** (`lib/services/booking.ts`):

1. Count this user's active bookings; refuse if they already hold five (`LIMIT_REACHED`).
2. Refuse a second booking of the same slot by the same person (`CONFLICT`).
3. Count non-cancelled bookings at this start time; refuse at three (`SLOT_FULL`).
4. Insert.

Under `SERIALIZABLE`, PostgreSQL behaves as if transactions ran one after another. When two overlap on the same slot, it commits one and aborts the other with a serialization failure, which Prisma reports as `P2034` (`isSerializationFailure` also recognises the raw Postgres codes `40001` and `40P01`, because driver adapters sometimes surface those instead). The code **retries the loser** (up to three times with a small random delay). On the retry the count is already three, so the user gets the clean "That slot just filled up" message instead of a crash or an overbooking.

Before the transaction, cheap rules run first in memory (`checkBookable`: inside the 14-day horizon, on a 30-minute boundary, 10:00 to 17:30 IST, at least 30 minutes ahead). The browser applies the same function to grey out slots, but the server never trusts it.

**Cancelling** is a single `UPDATE ... WHERE id = ? AND userId = ? AND status = 'SCHEDULED'` through `updateMany`. The condition is inside the statement, so a double-click or a second tab cannot cancel something that started in the meantime, and no "read, then write" gap exists. If zero rows match, a follow-up read decides between "not found" and "wrong state".

*Alternatives considered:* a `SELECT ... FOR UPDATE` on a slots table (needs a table of slots to lock and a job that creates them), or an advisory lock per start time (works, but is invisible in the schema). Serializable isolation needs neither and keeps the rule readable in one function; its cost is the retry loop.

## 7. The life of an interview

```
        book                start                      submit
(none) ───────▶ SCHEDULED ───────────▶ IN_PROGRESS ───────────▶ COMPLETED ──▶ Feedback row
                   │
                   └── cancel ──▶ CANCELLED          (a SCHEDULED slot that has passed is *shown* as MISSED)
```

Every arrow is a single conditional `UPDATE ... WHERE status = <expected>`, so retries, double clicks and two open tabs cannot move an interview twice (`lib/services/session.ts`).

**Start** (`POST /api/interviews/:id/questions`). `canStart` (pure, in `lib/status.ts`) allows the room from 10 minutes before the slot until it ends, or at any time when `DEMO_MODE` is on. If the résumé was requested, the PDF is read from storage and sent to the model. Questions are generated, then stored together with the status change in one update. If the user reloads the room, the stored questions are returned; they are never generated twice. If another tab won the race, the stored version wins.

**Autosave** (`saveAnswerAction`, about 1.2 seconds after the last keystroke; `PATCH /api/interviews/:id` is the REST equivalent). Each answer is written with a single atomic `jsonb_set` statement that patches only that question's key. The obvious alternative, reading the transcript, editing it in JavaScript and writing it back, loses an answer whenever two saves overlap (two tabs, or a slow network delivering saves out of order). Here the database patches the one key, and the `WHERE` clause includes `status = 'IN_PROGRESS'`, so a save can never land on a finished interview. This is the one raw SQL statement in the project and it is parameterised.

**Submit** (`POST /api/interviews/:id/evaluate`). The browser sends the answers on screen so the last keystrokes are not lost. The server merges them into the stored transcript, asks the AI for the report *before* touching the database (so no transaction is held open for seconds), computes the overall score, then in one transaction flips `IN_PROGRESS → COMPLETED` and creates the `Feedback` row. If a second submit arrives, either the conditional update matches nothing or the unique constraint on `Feedback.interviewId` fires (`P2002`); both paths return the existing report. The endpoint is **idempotent**, so a retry after a network failure is safe.

## 8. The AI pipeline

`lib/ai/index.ts` is the only module the rest of the app imports for AI. It exposes `generateQuestions` and `evaluateSession` and hides which provider answered.

```
prompt (lib/ai/prompts.ts)
   │  answers fenced in <answer> tags, system prompt says they are data
   ▼
Gemini generateContent  (lib/ai/gemini.ts)   responseMimeType = application/json + responseJsonSchema
   │
   ▼
parse JSON (tolerates a code fence)  ──▶  Zod schema  ──▶  reconcileEvaluation
   │                                            │ fails?
   │                                            ▼
   │                           one repair attempt: the problems are listed back to the model
   │                                            │ fails again?
   ▼                                            ▼
 stored report  ◀───────────────────────  offline rubric evaluator (AI_FALLBACK=true)
```

Principles:

- **The model is untrusted.** Its reply is parsed, validated by Zod, and reconciled with the transcript before anything is stored. `reconcileEvaluation` guarantees one entry per question in the order asked, drops unknown ids, rejects a report that skipped a question (so the caller asks again), and forces a blank or near-blank answer to score 0 even if the model was generous.
- **The model never does arithmetic that we trust.** It scores each answer from 0 to 10. The overall score is `round(mean(scores) × 10)`, computed in `lib/scoring.ts`, and the readiness band (below 50, below 75, above) is derived from it on the server.
- **Prompt injection stance.** Candidate answers and the résumé are fenced in tags, the system prompt says they are data and not instructions, and `fence()` strips any tag a candidate types that would close or forge the fence. Even a perfectly successful injection can only change *that candidate's own* per-question scores; it cannot change another user's data, because the model has no tools and the server decides everything else.
- **The JSON Schema sent to Gemini and the Zod schema are two descriptions of one contract.** `tests/ai-contract.test.ts` fails if they drift.
- **Annotations are quotes, located by the server.** The model returns `{ kind, quote, note }`. `lib/annotate.ts` finds each quote in the answer, tolerating case, whitespace, curly quotes and ellipses, and the report renders `<mark>` around the match. A quote that cannot be located is shown as a note beside the answer rather than dropped.
- **A provider switch, not a code branch.** `AI_MODE` / the presence of a key picks Gemini or the offline evaluator. The offline evaluator scores answers against the rubric of the built-in question bank, so the whole product demos without a key, and it is what keeps a session from being lost when the API is down. Each report stores the model that produced it (`Feedback.model`).
- **The model name is configuration.** Models are retired regularly; `GEMINI_MODEL` changes it without a code change. The course FAQ names Gemini 1.5 Flash, which Google has retired, so the default is a current Flash model.

*Trade-off:* Gemini is called with `fetch`, not an SDK. It is one POST, the dependency list stays short, and the whole integration (headers, body, error mapping) is readable in one file.

## 9. Authentication and authorization

**Authentication** is Auth.js v5: a Credentials provider (bcrypt, cost 12) and an optional Google provider. Sessions are **JWTs in an HttpOnly cookie** (7 days). Credentials sign-in cannot use database sessions in Auth.js, and a JWT also saves a database query on every page. The Prisma adapter stores users and linked Google accounts.

Details that are easy to get wrong:

- **Login does not reveal which part was wrong**, and an unknown email still runs a bcrypt comparison against a dummy hash, so response time does not leak which accounts exist.
- **Rate limits are keyed twice**, by IP and by account, so one guesser cannot lock a real user out from elsewhere.
- **`callbackUrl` is checked** (`safeCallbackUrl`): only same-site paths are followed after login, which blocks open redirects. A path must start with a single `/` and contain no backslash or control character, because browsers delete tabs and newlines from a URL (`/\t/evil.example` would otherwise become `//evil.example`).
- **Registration relies on the `UNIQUE` constraint**, then translates `P2002` into a friendly message. Check-then-insert would let two simultaneous sign-ups both pass.

**Authorization** is checked at four independent points; each stands on its own:

| Layer | Check | Why it exists |
| --- | --- | --- |
| `proxy.ts` | A session cookie is present, else redirect to `/login?callbackUrl=` | Cheap and early. *Optimistic only*: it cannot tell whether the cookie is still valid. |
| Layouts and pages | `requireUser()` | The real check for page rendering. Pages ask again themselves because layouts do not re-render on client-side navigation. |
| Actions and Route Handlers | `assertUser()` throws a 401-style `AppError` | They can be called without going through any layout. |
| Row access | Every query includes `userId` | One user can never read another's interview: `GET /api/interviews/:id` for someone else's booking returns 404, the same as a missing one. |

**Role-based access control.** `User.role` is `USER` or `ADMIN`. The role is copied into the JWT for cheap display decisions, but the JWT's copy can be stale, so anything that matters (`/admin`, `GET /api/admin/stats`, `setRoleAction`) calls `assertRole("ADMIN")`, which re-reads the role from the database. `/admin` answers **404** to non-admins so the route does not advertise itself. Role changes run in a serializable transaction that refuses to remove the last admin.

`proxy.ts` deliberately does not redirect signed-in users away from `/login`. With a stale cookie that would bounce between `/login` and `/dashboard` forever. The `(auth)` layout does it instead, using the verified session.

## 10. Résumé upload

The course requires a **Server Action** to receive the file and push it to Supabase Storage. `uploadResumeAction` does exactly that:

1. `assertUser`, then a rate limit (6 per minute).
2. Browser-side `checkResumeMeta` already refused wrong type or size; the server repeats it, because the browser is not a security boundary.
3. The file's bytes are read and the first five checked against the PDF signature `%PDF-`. The declared MIME type is only a claim; the bytes are the evidence.
4. The object is uploaded to a **private** bucket at `<userId>/<random uuid>.pdf` with the service-role key (server only, never `NEXT_PUBLIC`).
5. The `Resume` row is upserted (one per user).
6. The previous object is deleted.

That order means a failure at any step leaves the user's old résumé intact, at worst with an orphaned file that is logged. If the database write fails, the freshly uploaded object is removed.

Downloads never expose a bucket URL. `GET /api/resume/:id/download` checks the résumé belongs to the caller, asks Supabase for a signed URL valid for **60 seconds**, and redirects to it. When an interview asks for tailored questions, the server reads the PDF from storage itself and sends it to Gemini inline; the browser is never involved.

`next.config.ts` raises the Server Action body limit to 5 MB (the default is 1 MB); the app caps files at 4 MB to stay under Vercel's 4.5 MB request ceiling.

## 11. Errors, logging and monitoring

- **One error type.** Services throw `AppError(code, message, { fieldErrors })`. `ERROR_STATUS` maps each code to an HTTP status (422 validation, 409 conflict or slot full, 429 rate limit, 502 bad AI output, ...). Only `runAction` and `withApi` translate it; nothing else knows about HTTP.
- **Failures are data, not exceptions, in forms.** `runAction` returns `{ ok: false, error, fieldErrors }`. It rethrows Next's control-flow errors (`redirect`, `notFound`) with `unstable_rethrow`, which is why `redirect` is called outside its `try`.
- **User-safe messages.** Anything that is not an `AppError` is logged in full and shown to the user as a generic message, so database errors never reach the browser.
- **Structured logs.** `lib/logger.ts` writes one JSON line per event. Field names that look like secrets (`password`, `token`, `cookie`, `apiKey`, `serviceRole`, ...) are replaced with `[redacted]`, and stack traces are omitted in production.
- **Request ids.** `proxy.ts` assigns an `x-request-id`; `withApi` echoes it in the response and in every log line and error body, so a user's error report can be matched to the server's log.
- **`instrumentation.ts`.** `onRequestError` logs every uncaught server error with its route and type. `register` is where an OpenTelemetry or Sentry SDK would be started.
- **Error UI.** An `error.tsx` boundary for the signed-in area and one at the root, `global-error.tsx` for failures in the root layout itself, `not-found.tsx`, and `loading.tsx` skeletons.
- **Performance monitoring.** `components/shared/web-vitals.tsx` reports CLS, FCP, INP, LCP and TTFB with `sendBeacon` to `POST /api/vitals`, which logs them (rate limited, size limited, anonymous). A log platform can chart them.

## 12. Security checklist

| Concern | What is done |
| --- | --- |
| Secrets | Read on the server through `lib/env.ts`; the service-role key and Gemini key never get a `NEXT_PUBLIC_` prefix and the files that use them import `server-only`. `.env` is git-ignored. |
| SQL injection | Prisma parameterises everything. The one raw statement uses tagged-template parameters. |
| Mass assignment | Zod parses every input into an explicit shape; services take typed arguments, never a raw body. |
| CSRF | Cookies are `SameSite=Lax`. Next.js compares `Origin` with the host on every Server Action. Route Handlers that write call `assertSameOrigin`. |
| XSS | React escapes output. The only `dangerouslySetInnerHTML` is the JSON-LD script on category pages, built from our own constants with `<` escaped. Highlights are rendered as `<mark>` elements from computed segments, never from HTML strings. |
| Clickjacking and sniffing | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` on every response. |
| Passwords | bcrypt (cost 12); Zod requires 8 to 72 characters with a letter and a number, and at most 72 bytes (bcrypt ignores anything past 72 bytes, and a letter outside English takes 2 to 4); generic login errors; equalised timing. |
| Abuse | Sliding-window rate limits on login, registration, booking, cancel, autosave, AI calls, résumé upload and the public vitals sink. |
| File upload | Size, extension, MIME and magic-byte checks on the server; random object names; private bucket; 60-second links. |
| Access control | Row filters on `userId`, role re-read from the database, 404 for other people's records. |
| Log hygiene | Secret-looking fields redacted; no passwords or tokens logged. |

## 13. Front-end structure

- **Server by default.** A component becomes a Client Component only when it needs state, effects, event handlers or browser APIs. Every `page.tsx` and `layout.tsx` is a Server Component; the only client files under `src/app` are the three error boundaries, which React requires to be client code. Of the 57 files in `src/components`, 27 are Client Components, and they are the leaves: forms, the interview room, the slot picker, the Radix-based dialog and menu, the toaster, the chart wrapper. Server Components pass them plain DTO props.
- **UI kit.** `components/ui` follows the shadcn/ui structure (Radix primitives, `class-variance-authority`, `tailwind-merge`, a `components.json`), so `npx shadcn add` works for further components. Only Dialog, Dropdown Menu and Label use Radix; the rest are plain elements, which keeps the bundle small.
- **Design tokens.** Colors, radii and fonts are CSS variables declared once in `globals.css` and exposed to Tailwind 4 with `@theme`. There is no light theme; the identity is a deep teal ground, cream text, a serif (Newsreader) for the text people read and a grotesque (Hanken Grotesk) for the interface, highlighter yellow for emphasis and coral for gaps.
- **Charts are hand-drawn SVG** (`ScoreRing`, `CompetencyRadar`, `TrendChart`), so there is no charting library, and each has a text alternative.
- **Accessibility.** A skip link, one `h1` per page, labels on every field, `aria-describedby` for hints and errors, focus-visible rings, keyboard-operable dialogs (Radix), status conveyed by text and not by colour alone, `prefers-reduced-motion` respected, and a print stylesheet for reports.
- **Motion** is limited to one orchestrated hero highlight sweep and small fade/pop transitions.

## 14. Testing

`npm test` runs the Node test runner through `tsx`, with no database or network:

| File | What it protects |
| --- | --- |
| `slots.test.ts` | Slot generation, IST/UTC boundaries, horizon, lead time, seat states |
| `status.test.ts` | Room opening window, derived MISSED, demo mode, cancel rules |
| `scoring.test.ts` | Overall score rounding, readiness bands, word counting |
| `annotate.test.ts` | Locating model quotes in answers (curly quotes, ellipses, overlaps) |
| `reconcile.test.ts` | Forcing blank answers to zero, ordering, rejecting skipped questions |
| `transcript.test.ts` | Merging late answers without mutating, ignoring unknown ids |
| `mock-evaluator.test.ts`, `question-bank.test.ts` | The offline evaluator and the built-in questions |
| `validations.test.ts` | Zod schemas for auth, booking, résumé metadata |
| `rate-limit.test.ts` | Sliding window, independence of keys, the 429 error |
| `ai-contract.test.ts` | The JSON Schema sent to Gemini cannot drift from the Zod schemas |
| `format.test.ts` | Date, size and plural formatting |

Not covered by automated tests: database transactions and the live Gemini and Supabase calls. The two database behaviours the design depends on were checked by hand against PostgreSQL 16 instead:

- **The booking race.** Two `SERIALIZABLE` sessions that both counted two taken seats and both inserted: one committed, the other was aborted with `could not serialize access due to read/write dependencies among transactions` (SQLSTATE 40001, "might succeed if retried"), and the slot ended with three seats. The same script at the default `READ COMMITTED` level ended with **four** people in a three-seat slot, which is the bug the transaction prevents. The steps are in [VIVA_CHEAT_SHEET.md](VIVA_CHEAT_SHEET.md#live-demo-the-booking-race) so they can be repeated on stage.
- **The autosave statement.** The `jsonb_set` update was run as a prepared statement with untyped parameters (how the `pg` driver sends them): a second save of the same question replaces it, saves of different questions keep each other, a hostile question id is stored as an ordinary key, and a save for another user or a finished interview updates zero rows. The initial migration also applies cleanly to an empty database.

A concurrency test against a real database in CI is the first thing to add (see below).

---

## Known limits

Honest list of what this project does not do, and what would be done next:

1. **Rate limiting is per server instance.** Counters live in memory, so on serverless hosting the effective limit is "per warm instance". Good enough to slow password guessing and runaway AI calls; a shared store such as Redis (Upstash) is the upgrade.
2. **No Content-Security-Policy yet.** Next injects inline scripts for hydration, so a correct policy needs per-request nonces in `proxy.ts`, which depends on the final deployment target. The other security headers are set.
3. **Database TLS is encrypted but not verified.** `lib/prisma-client.ts` uses `rejectUnauthorized: false` because Supabase's certificate chain does not validate against the default store in `node-postgres`. Pinning the Supabase CA is the fix.
4. **Auth.js v5 is still a beta release line.** Its version is pinned exactly so a reinstall cannot move it.
5. **No email verification or password reset.** Credentials sign-up trusts the address.
6. **The offline evaluator is a heuristic.** It scores against a rubric by keyword and structure. It is honest about being offline (`Feedback.model` says so) but it is not a language model.
7. **Autosave is last write wins per question.** Two tabs typing the same answer would overwrite each other; different questions never collide.
8. **No automated test against a real database.** The booking race and the autosave SQL were verified by hand on PostgreSQL 16 (see section 14); there is no integration suite in CI yet.
9. **`DEMO_MODE`** lets interviews start outside their slot. It must be off in production.
10. **English only, typed answers only, dark theme only.** See the README's scope list.
