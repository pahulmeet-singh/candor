# Testing

Candor has three layers of automated tests. Each layer catches a different kind of mistake, and each can be run on its own.

| Layer | Command | Needs | Size | What it proves |
| --- | --- | --- | --- | --- |
| Unit | `npm test` | Node only | 216 tests in 22 files | The pure rules: slots, statuses, scoring, validation, the rate limiter, the "never wipe a real database" guard, and the integrity monitor's logic (head-turn estimate, span trackers, the browser's outbox, the server's checks, the report summary) |
| Integration | `npm run test:integration` | A local PostgreSQL | 33 tests in 5 files | The services against a real database: the booking race, the interview lifecycle, roles, the schema's constraints, integrity events and their database rules |
| End to end | `npm run test:e2e` | PostgreSQL and Chromium | 21 tests in 4 files | A real browser driving a production build: sign-up, booking, answering, grading, the report, access control, and an assessment with a synthetic camera |

`.github/workflows/ci.yml` runs all three on every push and pull request (see [CI](#ci)).

## Why a real database

The most important rules in Candor live in PostgreSQL, not in JavaScript: a `SERIALIZABLE` transaction stops a fourth person taking the third seat, a conditional `UPDATE ... WHERE status = ...` stops a double submit, one `jsonb_set` statement stops two autosaves overwriting each other, and `ON DELETE CASCADE` cleans up after a deleted user. A mocked database would only prove that the code calls the mock. These tests run the real services against the real engine, so a regression in any of those rules fails a test.

## Run the unit tests

```bash
npm test
```

Nothing to set up. The glob is `tests/*.test.js`, so the database tests in `tests/integration/` are not included.

## One-time setup for the database tests

You need a throwaway PostgreSQL database whose name contains `test`. The suites empty it, so it must never be your Supabase database.

```bash
# Option A: Docker
docker run --name candor-test-db -e POSTGRES_USER=candor -e POSTGRES_PASSWORD=candor \
  -e POSTGRES_DB=candor_test -p 5432:5432 -d postgres:16

# Option B: a PostgreSQL you installed yourself
createdb candor_test
```

Tell the tests where it is, in either of two ways:

- Add `TEST_DATABASE_URL="postgresql://candor:candor@localhost:5432/candor_test"` to your `.env` (there is a commented line in `.env.example`), **or**
- Set it in the shell. bash: `export TEST_DATABASE_URL=...`; PowerShell: `$env:TEST_DATABASE_URL="..."`; Command Prompt: `set TEST_DATABASE_URL=...`.

If port 5432 is taken, map the container to another port (`-p 5433:5432`) and use `:5433` in the URL.

Create the tables once, from the committed migrations:

```bash
npm run test:db:migrate
```

### The safety guard

`tests/integration/guard.js` refuses to run unless `TEST_DATABASE_URL` points at a **local host** (localhost, 127.0.0.1 or ::1) and a database whose **name contains "test"**. It ignores `DATABASE_URL` completely, so a `.env` that points at Supabase cannot be wiped by accident. The same guard protects `test:db:migrate` and the browser tests. It is a pure function with its own unit tests (`tests/test-database-guard.test.js`).

## Run the integration tests

```bash
npm run test:integration
```

The script is `tsx --tsconfig jsconfig.json --conditions=react-server --test --test-concurrency=1 "tests/integration/*.test.js"`:

- `--tsconfig jsconfig.json` is how `tsx` learns the `@/` import alias (it does not look for a `jsconfig.json` on its own).
- `--conditions=react-server` lets Node import files that start with `import "server-only"`, the way Next.js does on the server. Without it the import throws on purpose.
- `--test-concurrency=1` runs one test file at a time, because all files share one database.

To run a single file: `npx tsx --tsconfig jsconfig.json --conditions=react-server --test tests/integration/booking.test.js`.

### How the tests stay deterministic

- **A fixed clock.** Every service takes `now` as an argument, and the tests pass `NOW` (Tuesday 10 November 2026, 09:30 IST) from `tests/integration/helpers.js`. Lead times, the 14-day horizon and the room's opening window give the same answer on any day and at any hour.
- **A different slot for every test.** `freshSlot()` hands out a new half-hour slot on each call, so tests never compete for the same three seats.
- **Offline AI.** `setup.js` sets `AI_MODE=mock` and removes `GEMINI_API_KEY`, so there is no network call and the report for the same answers is always the same.
- **Real rules.** `DEMO_MODE` is removed, so a room really only opens ten minutes before its slot.
- **Clean tables.** Each file empties the tables before and after it runs.

### What they cover

| File | Tests |
| --- | --- |
| `booking.test.js` | A booking shows as "mine" on the slot map. The same person cannot book a slot twice. Off-grid, too-soon and too-far times are refused. Tailored questions need a saved résumé. **Eight people race for three seats, twice: exactly three win and the table agrees.** Five upcoming bookings per person, and another is allowed after a cancel. Cancelling frees the seat, works once, and only for the owner. |
| `session.test.js` | A whole session: the room is refused too early, opens on time, a reload does not rewrite the questions, **two overlapping autosaves both survive**, saving again replaces the text, submitting grades the newest text and stores one report, a repeat submit returns the same report, and a finished interview is frozen. Two tabs starting at once write one set of questions. **Three simultaneous submits create exactly one report.** One person cannot touch another person's interview. State rules for starting, answering and submitting. |
| `accounts.test.js` | Only a bcrypt hash is stored. A duplicate email is refused and points at the field. **Two simultaneous sign-ups with one email: one wins.** Nobody changes their own role, the last admin is never demoted, promoting and demoting work, and **two admins demoting each other at once cannot leave zero admins.** |
| `schema.test.js` | Deleting a user cascades to their interviews and reports. Deleting a résumé keeps the interview and clears the link. Email is unique in the database itself. One report per interview. |
| `integrity.test.js` | An assessment is booked only with consent, and the time it was given (by the server's clock) is stored; a practice booking stores none. **The database refuses, by itself, an assessment with no consent, a practice interview switched to an assessment, a negative duration, and a `detail` that holds anything but a character count.** A running assessment stores its events tidied up: one from an hour before the session is dropped, a paste's claimed duration becomes 0, an unknown question id is stored as none, and `detail` survives only on a paste. A browser whose clock is seven minutes fast is lined up with the server's. **Two batches arriving at the same moment both survive.** Events are refused for a practice interview, one that has not started, someone else's (404) and one that has been submitted, whose record is frozen. At the 300-event limit what fits is stored and the rest is counted as dropped. An assessment's report carries a summary (8 points, `REVIEW`, the timeline in order) and a practice report has none; nobody else can open it. Events are deleted with their user. |

## Run the browser tests

One-time: download the browser Playwright drives.

```bash
npm run test:e2e:browser      # npx playwright install chromium
```

Then, with `TEST_DATABASE_URL` set and the tables created:

```bash
npm run test:e2e
```

Playwright (`playwright.config.js`) runs `npm run build && npm run start` on **port 3100** (change it with `E2E_PORT`; it is not 3000, so a running `npm run dev` is left alone), waits for `/api/health`, and then runs the tests in Chromium. While you iterate on a test, `E2E_SKIP_BUILD=1 npm run test:e2e` reuses the last build.

The test server gets these settings, and nothing else in the project sets them:

| Variable | Why |
| --- | --- |
| `AI_MODE=mock` | The offline questions and rubric evaluator: no network, no key, same result every time. |
| `DEMO_MODE=true` | A booked interview can start at once instead of at its slot time. |
| `DISABLE_RATE_LIMITS=true` | Every test signs up its own user from one address, which the real limits (six sign-ups an hour) would block. Only exactly `true` counts, and `tests/rate-limit.test.js` checks that. |
| `GEMINI_API_KEY`, `SUPABASE_*`, `AUTH_GOOGLE_*` set to empty | A developer's real keys in `.env` never reach the test server. |

### What they cover

| File | Tests |
| --- | --- |
| `public.spec.js` | The landing, categories and sample-report pages render. `/api/health` answers with JSON. An unknown address shows the friendly 404 page. Six protected paths send a signed-out visitor to `/login?callbackUrl=...` and remember where they were going. |
| `auth.spec.js` | Sign-up lands on a personal dashboard. Each field's error is explained. A second sign-up with the same email is refused. Signing in again works from a clean browser. A wrong password gets one generic message. An ordinary user gets the 404 page at `/admin`. |
| `journey.spec.js` | Register, book tomorrow's first open slot, open the room, start, see an answer autosave and survive a reload, answer five questions, review and submit, read the report (the pop-up and the standalone page, which has **no** "Presence and focus" section because a practice interview is never watched), find the finished room redirecting to the report, and check that a **different user gets the 404 page** for both the interview and its report. |
| `assessment.spec.js` | An assessment cannot be booked until the consent box is ticked, and the reason appears next to the box. The details page says "This is an assessment". In the room, the monitoring panel is visible and a pasted block of 120 characters is counted; after submitting, the standalone report has a "Presence and focus" section that lists the paste, says it is a signal and not proof, and says it never changes the score. **A practice interview never asks the browser for the camera** (the test counts calls to `getUserMedia`). |

Three details that matter when you read or extend them:

- **Hydration.** The forms are React forms. Submitting one before the page has finished loading its JavaScript would reload the page instead of running the action, so `open()` in `e2e/helpers.js` waits for the network to go quiet before the test touches a field.
- **The report opens in a window.** After submitting, the app navigates to `/feedback/<id>` and an intercepted route shows the report in a dialog over the room (`app/(app)/@modal/(.)feedback/[id]`). The journey test therefore checks what the dialog and the standalone page share, then loads the same address directly to check the standalone page's heading.
- **The camera is synthetic.** `assessment.spec.js` starts Chromium with `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` and grants the `camera` permission, so no hardware or prompt is involved. The fake picture has no face in it, so these tests deliberately do not depend on the face detector finding one, or even on its model downloading: they check consent, what the candidate is told, that a paste is noted and reaches the report, and that a practice interview never touches the camera. The paste is a synthetic `ClipboardEvent` dispatched on the answer box.

Reports and traces from a failed run are in `playwright-report/` and `test-results/` (both git-ignored). Open them with `npx playwright show-report` and `npx playwright show-trace <trace.zip>`.

## CI

`.github/workflows/ci.yml` has three independent jobs, so one failure does not hide the others:

| Job | Steps |
| --- | --- |
| `quality` | install, `npm run lint`, `npm test`, `npm run build` (no database needed) |
| `integration` | PostgreSQL 16 service container, `npm run test:db:migrate`, `npm run test:integration` |
| `e2e` | PostgreSQL 16 service container, install Chromium, `npm run test:db:migrate`, `npm run test:e2e`, upload the Playwright report if anything failed |

`npm install` also runs `postinstall`, which copies the face detector's WebAssembly files into `public/mediapipe/` (git-ignored), so the production build that the browser tests start has them to serve.

The repository has no `package-lock.json` until you run `npm install` once and commit the file it creates. Until then CI uses `npm install`; afterwards it uses `npm ci` and turns on npm caching by itself.

To show the status on the repository's front page, add this under the title of `README.md` (replace `OWNER/REPO`):

```markdown
![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)
```

## What the tests do not cover

- The live Gemini API and Supabase Storage. The offline provider stands in for Gemini, and résumé upload is not exercised because it needs a Supabase bucket.
- Load and stress behaviour, visual appearance and automated accessibility audits.
- Browsers other than Chromium.
- **Whether the face checks are accurate.** The rules around the detector are unit tested (the head-turn maths, how long a condition must last, how events are batched and checked), but the detector itself is MediaPipe's, and the thresholds (a head turn of 0.35 eye-distances; 3, 2 and 4 seconds) were chosen by reasoning, not measured on real faces, lighting or webcams. Tuning them needs real recordings. See [INTEGRITY.md](INTEGRITY.md#known-limits).
- A real face in front of a real camera. The browser tests use a synthetic camera with no face in it.

## If something fails

| Symptom | Cause and fix |
| --- | --- |
| `TEST_DATABASE_URL is not set` | Set it in `.env` or the shell (see above). |
| `The database name ... does not contain "test"` or `The host ... is not local` | The guard is doing its job. Point the variable at a local database named like `candor_test`. |
| `relation "User" does not exist` | The tables are missing. Run `npm run test:db:migrate`. |
| `ECONNREFUSED` or `password authentication failed` | PostgreSQL is not running, or the URL's user, password, host or port is wrong. Check it with `psql "$TEST_DATABASE_URL"`. |
| `This module cannot be imported from a Client Component module` | A test was started without `--conditions=react-server`. Use `npm run test:integration`. |
| `Executable doesn't exist ... chromium` | Run `npm run test:e2e:browser` once. |
| `http://localhost:3100 is already used` | Another process owns the port. Stop it, or set `E2E_PORT`. |
| A browser test times out on `toHaveURL(/dashboard/)` | The server did not start or the database call failed. Read the server output that Playwright prints above the failure, then open the trace. |
