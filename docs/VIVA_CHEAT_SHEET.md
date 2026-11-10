# Viva cheat sheet

For INT257 · Modern Web Application Development. Read it once, then use it as a map: every answer points at the file where the proof lives, so you can open it instead of describing it.

- [The 60-second pitch](#the-60-second-pitch)
- [Splitting the talking](#splitting-the-talking)
- [Syllabus map](#syllabus-map)
- [Practicals map](#practicals-map)
- [Demo script (about 8 minutes)](#demo-script-about-8-minutes)
- [Live demo: the booking race](#live-demo-the-booking-race)
- [Questions and answers](#questions-and-answers)
- [Numbers to remember](#numbers-to-remember)
- [Files worth opening](#files-worth-opening)
- [Pre-flight and if something breaks](#pre-flight-and-if-something-breaks)

---

## The 60-second pitch

> Candor is a mock interview platform. A student picks a category and a 30-minute slot, answers five questions in their own words, and gets a report that highlights the exact sentences that were strong or weak, with a score out of 100 and a model answer for each question.
>
> It is a Next.js 16 App Router application. Public pages are static or ISR, signed-in pages are server-rendered, and the interactive parts (slot picker, interview room) are small Client Components. Mutations are Server Actions, including the résumé upload that goes to Supabase Storage. Reads other clients may want, and the slow AI calls, are Route Handlers. Everything talks to PostgreSQL through Prisma, and Auth.js protects the routes with role-based access.
>
> The two parts we are proudest of are the booking transaction that cannot overbook a slot, and the AI pipeline that treats the model as untrusted: its output is validated, reconciled and re-scored on the server, and an offline evaluator takes over if the API is down.

## Splitting the talking

Everyone should be able to explain every layer at a high level. This is a suggested split for who goes deep on what; change it to match who actually built what.

| Member | Goes deep on | Files to know |
| --- | --- | --- |
| **A: front end and routing** | Layouts and route groups, rendering strategy per route, parallel and intercepting routes, UI kit, accessibility, SEO and metadata | `src/app/**`, `src/components/**`, `globals.css` |
| **B: data and auth** | Prisma schema and migrations, seed, Auth.js, RBAC, the booking service and transaction, Server Actions, résumé upload | `prisma/**`, `src/lib/auth/**`, `src/lib/services/booking.ts`, `src/actions/**`, `src/lib/services/resume.ts` |
| **C: AI and platform** | Gemini integration, prompts and schemas, reconcile, session lifecycle and autosave, Route Handlers, errors and logging, tests, deployment | `src/lib/ai/**`, `src/lib/services/session.ts`, `src/app/api/**`, `src/lib/http.ts`, `tests/**` |

## Syllabus map

Every topic in the syllabus, and where to point at it.

### Unit I

| Topic | In Candor |
| --- | --- |
| Next.js features, project structure, App Router, dev workflow | `src/app` with route groups; `npm run dev`, `typecheck`, `lint`, `test`; README "Project structure" |
| File-based routing | Every `page.tsx` under `src/app` |
| Dynamic routes | `categories/[slug]`, `interviews/[id]`, `feedback/[id]`, `api/**/[id]` |
| Nested routes and layouts | `interviews/[id]/session`; root layout, `(marketing)`, `(auth)`, `(app)` and `dashboard` layouts |
| Navigation | `next/link` everywhere, `usePathname` for the active nav item, `useRouter` after mutations, `redirect()` in actions and pages |
| Error and loading UI | `loading.tsx` at `(app)`, `interviews`, `feedback` and each dashboard slot; `error.tsx`, `global-error.tsx`, `not-found.tsx` |

### Unit II

| Topic | In Candor |
| --- | --- |
| SSR | All signed-in pages: `src/app/(app)/**` |
| SSG | `categories/[slug]` with `generateStaticParams` and `dynamicParams = false`; `/categories`; `/sample-report` |
| ISR | `/` with `revalidate = 600` |
| Client-side rendering | Booking form, interview room, auth forms, résumé uploader |
| Choosing a strategy | README table "Where each rendering strategy is used" |
| Server and Client Components | Pages are Server Components; 27 leaf components are client (`"use client"`) |
| Fetch API, client-side fetching | `components/booking/use-slots.ts` calls `/api/slots`; `start-panel.tsx` and `interview-room.tsx` call the AI routes; `lib/ai/gemini.ts` uses server-side `fetch` |
| Server-side data fetching | Pages call `src/lib/data/*` directly, no HTTP hop |
| Caching and revalidation | `unstable_cache` + tag in `lib/data/public-stats.ts`; `revalidatePath` in actions; `revalidateTag` in the evaluate handler |

### Unit III

| Topic | In Candor |
| --- | --- |
| Route Handlers, REST, HTTP methods | `src/app/api/**`: GET, POST, PATCH, DELETE; [docs/API.md](API.md) |
| Dynamic Route Handlers | `api/interviews/[id]`, `[id]/questions`, `[id]/evaluate`, `api/feedback/[id]` |
| Request and response handling | `NextRequest`, `NextResponse.json`, 201 with `Location`, 302 redirect, 204, `x-request-id`, one error envelope (`lib/http.ts`) |
| Server Actions, forms, validation | `src/actions/*`; `useActionState` in login, register, résumé, role forms; Zod through `parseInput` |
| File upload | `uploadResumeAction` and `lib/services/resume.ts` |
| Data mutations | book, cancel, save answer, upload, delete, set role |
| Optimistic UI | `useOptimistic` in `components/interview/interview-list.tsx` (the cancelled row disappears at once) |

### Unit IV

| Topic | In Candor |
| --- | --- |
| Authentication concepts, session management | Auth.js, Credentials and Google, JWT in an HttpOnly cookie (7 days): `lib/auth/auth.ts` |
| Protected routes | `proxy.ts` (optimistic), `requireUser()` in layouts and pages, `assertUser()` in actions and handlers |
| Authorization, RBAC | `User.role`, `assertRole("ADMIN")` re-reading the database, `/admin` answers 404 |
| ORM basics, connectivity | `prisma/schema.prisma`, `lib/prisma-client.ts` (driver adapter), `lib/db.ts` (singleton) |
| CRUD | Create: booking, register, résumé. Read: `lib/data/*`. Update: start, autosave, cancel, role. Delete: résumé, cancel (soft) |
| Data validation | Zod at every boundary and again on the JSON columns when read back; database constraints (unique, foreign keys) |
| Environment variables | `.env.example`, typed lazy access in `lib/env.ts`, `server-only` on secret-using modules |

### Unit V

| Topic | In Candor |
| --- | --- |
| Image optimization | `next/image` for the avatar in `layout/user-menu.tsx`; `next/font` self-hosts both fonts |
| Metadata API, SEO | `metadata` in the root layout, `generateMetadata` and JSON-LD on category pages, `opengraph-image.tsx`, `icon.svg`, `sitemap.ts`, `robots.ts`, canonical URLs |
| Code splitting, lazy loading | `next/dynamic` for the trend chart (`shared/trend-chart-lazy.tsx`); route-level splitting by the App Router |
| Production build, environment configuration | `npm run build`, [docs/DEPLOYMENT.md](DEPLOYMENT.md) |
| Deployment platforms | Vercel + Supabase, steps in DEPLOYMENT.md |
| Performance monitoring | Core Web Vitals sent to `/api/vitals` and logged (`shared/web-vitals.tsx`) |
| Error logging | `instrumentation.ts` `onRequestError`, JSON logger with redaction, request ids |

### Unit VI

| Topic | In Candor |
| --- | --- |
| Parallel routes | `dashboard/@stats`, `@trend`, `@upcoming`; `(app)/@modal` |
| Proxy | `src/proxy.ts` (Next 16's rename of middleware) |
| Intercepting routes | `(app)/@modal/(.)feedback/[id]` |
| Edge runtime | `api/health` with `export const runtime = "edge"` |
| Internationalization | **Not implemented.** How we would do it is in the answers below |
| Project architecture, component organization | Layered `app → services → data`, feature folders in `components`, [ARCHITECTURE.md](ARCHITECTURE.md) |
| Security best practices | [ARCHITECTURE.md section 12](ARCHITECTURE.md#12-security-checklist) |
| Testing overview | `tests/`, 91 unit tests, `npm test` |

### Course outcomes at a glance

| CO | Where it is shown |
| --- | --- |
| CO1 Architecture and routing | Route groups, nested layouts, dynamic, parallel and intercepting routes |
| CO2 Rendering and data fetching | Static, SSG, ISR, SSR and CSR each used on purpose; cache and revalidation |
| CO3 APIs and Server Actions | 11 Route Handlers and 10 Server Actions sharing one service layer |
| CO4 Authentication and database | Auth.js with RBAC; Prisma with transactions and migrations |
| CO5 Performance and deployment | `next/dynamic`, `next/image`, `next/font`, web vitals, Vercel guide |
| CO6 Scalable practices | Layering, DTOs, one error type, rate limiting, tests, documented limits |

## Practicals map

| Practical | Show |
| --- | --- |
| Create an app and explore the App Router structure | `src/app` tree; run `npm run dev` |
| Nested, dynamic routing, layouts, loading and error UI | `/interviews/[id]/session`, `loading.tsx`, `error.tsx` |
| Server and client data fetching, compare rendering | README rendering table; `use-slots.ts` vs `lib/data` |
| Caching and revalidation | `/` ISR and the counter that changes after a report is saved |
| REST APIs with Route Handlers and HTTP methods | `docs/API.md`, curl examples |
| Forms, validation, files, mutations with Server Actions | Register form errors; résumé upload with a fake PDF |
| Database with an ORM and CRUD | `schema.prisma`, `lib/data`, `lib/services`, Prisma Studio |
| Auth, sessions, protected routes, RBAC | Sign out then open `/dashboard`; `/admin` as student and as admin |
| Image optimization, metadata, code splitting, lazy loading | `user-menu.tsx`, `generateMetadata`, `trend-chart-lazy.tsx` |
| Production build, environment, monitoring, logging | `npm run build` route table; JSON logs; `/api/health` |

---

## Demo script (about 8 minutes)

Use two browser profiles (or one normal and one private window) so you can be two people. Run the seed first. `DEMO_MODE=true` lets you start a session immediately.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Open `/` | "Static page, rebuilt in the background every ten minutes (ISR). The counters are cached with a tag and refresh the moment a report is saved." |
| 0:40 | Click a category, then `/sample-report` | "Six category pages are generated at build time from `generateStaticParams`. The sample report is a fixture so visitors see the product before signing up." |
| 1:20 | Sign in as `student@candor.test` | "Credentials sign-in through a Server Action. Wrong password gives one generic message." |
| 1:40 | Dashboard | "Three parallel-route slots stream in independently, each with its own loading state." |
| 2:20 | `/interviews/new`: choose a category, a day, a slot | "Picking a day is a client `fetch` to `/api/slots`. A slot shows how many of three seats are taken." |
| 3:00 | Book it | "That is a Server Action calling one booking service. The check and the insert run in a serializable transaction." Show the toast and the new row. |
| 3:30 | In the other window sign in as `rohan@candor.test` and book the same slot | "Same service, seat count goes up. A fourth person would see 'slot just filled up'." |
| 4:00 | Open your booking, start the session | "Starting calls a Route Handler. Gemini writes five questions; reloading never regenerates them." |
| 4:30 | Type two answers, show "Saved" | "Autosave is a Server Action that patches one key of the JSON with `jsonb_set`, so two saves can never overwrite each other." |
| 5:15 | Submit | "Gemini grades it, we validate and re-score on the server, then store it in one transaction." |
| 6:00 | Report | "Highlights come from quotes the model returned; we locate them in your text. Overall score is computed by us, not the model." |
| 6:30 | `/feedback`, open a report, then refresh | "Intercepting route: a dialog from inside the app, a full page on refresh." |
| 7:00 | `/resume`: upload a PDF; then upload a renamed `.txt` | "Server Action, checked on the server including the `%PDF-` signature, stored in a private bucket. Downloads are 60-second signed links." |
| 7:30 | `/admin` as student (404), then as `admin@candor.test` | "Role checked in the database, not the token. 404 so the route does not advertise itself." |
| 7:50 | Open `lib/services/booking.ts` | "And this is the transaction. Happy to show the race at the SQL level." (see below) |

## Live demo: the booking race

This shows, in two terminal windows, why `bookInterview` uses a serializable transaction. Use a **scratch** database that has the migration applied, never your real one (it empties the tables).

**Setup, once** (any window, `psql "$DIRECT_URL"` or your local database):

```sql
TRUNCATE "Feedback", "Interview", "Resume", "User" CASCADE;
INSERT INTO "User"(id, email, "updatedAt") VALUES
  ('u1','u1@t.test',now()), ('u2','u2@t.test',now()), ('u3','u3@t.test',now()), ('u4','u4@t.test',now());
-- two of the three seats at one slot are taken
INSERT INTO "Interview"(id, "userId", category, difficulty, "scheduledAt", "updatedAt") VALUES
  ('i1','u1','FRONTEND','INTERMEDIATE','2026-11-03 05:00:00+00', now()),
  ('i2','u2','BACKEND','INTERMEDIATE','2026-11-03 05:00:00+00', now());
```

**The race.** Open two windows, A and B, and type the lines in this order:

```sql
-- A
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM "Interview" WHERE "scheduledAt" = '2026-11-03 05:00:00+00' AND status <> 'CANCELLED';   -- 2

-- B
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM "Interview" WHERE "scheduledAt" = '2026-11-03 05:00:00+00' AND status <> 'CANCELLED';   -- 2

-- A  (2 < 3, so the app would let u3 in)
INSERT INTO "Interview"(id, "userId", category, difficulty, "scheduledAt", "updatedAt")
  VALUES ('i3','u3','DSA','BEGINNER','2026-11-03 05:00:00+00', now());

-- B  (it also saw 2, so it would let u4 in)
INSERT INTO "Interview"(id, "userId", category, difficulty, "scheduledAt", "updatedAt")
  VALUES ('i4','u4','DSA','BEGINNER','2026-11-03 05:00:00+00', now());

-- A
COMMIT;

-- B
COMMIT;
```

**What you will see.** One of the two windows fails, at its `INSERT` or at its `COMMIT`:

```
ERROR:  could not serialize access due to read/write dependencies among transactions
HINT:   The transaction might succeed if retried.
```

The slot ends with **three** seats. Prisma reports this error as `P2034`; `bookInterview` catches it and retries, and on the retry the count is already three, so the loser gets the clean "That slot just filled up" message.

**The control.** Run `ROLLBACK;` in any window that is still open, redo the setup, and repeat the same steps with plain `BEGIN;` (the default `READ COMMITTED` level). Both commits succeed and the slot has **four** people in three seats. That is the bug the transaction exists to prevent.

This sequence was run against PostgreSQL 16 while preparing these notes: one commit, one `40001`, three seats; and four seats at the default level.

---

## Questions and answers

Short answers you can say out loud, with the file to open.

### Next.js fundamentals and routing

**What is the App Router, and what does it give you over the Pages Router?**
Routing by folders in `app/`, where a `page.tsx` makes a route and a `layout.tsx` wraps its children and stays mounted between navigations. Components are Server Components by default, loading and error UI are files (`loading.tsx`, `error.tsx`), data is fetched where it is used, and API endpoints are `route.ts` files next to the pages.

**Walk me through a request to `/dashboard`.**
`proxy.ts` checks a session cookie exists and tags the request with an id. `(app)/layout.tsx` calls `requireUser()`. `dashboard/layout.tsx` composes `children` and the three slots. Each slot page asks `lib/data` for its own data, so they render and stream independently, each behind its `loading.tsx`. The browser gets HTML plus the React Server Component payload, and only the client leaves (menu, chart wrapper) hydrate.

**Why three route groups?**
`(marketing)`, `(auth)` and `(app)` do not change the URL; they exist to give each area its own layout and its own rule. Marketing has the public header and footer, auth redirects signed-in users away, and app has the sidebar shell and the session guard.

**Why `proxy.ts` and not `middleware.ts`?**
Next.js 16 renamed middleware to proxy and runs it on the Node.js runtime. It is the same idea: code that runs before a request is routed. Ours does two cheap things, an optimistic "is there a session cookie?" redirect and a request id. It is deliberately not the authorization layer, because it cannot tell whether the cookie is still valid.

**What are parallel routes and where do you use them?**
Folders prefixed with `@` are slots, passed to the parent layout as props. We use `@stats`, `@trend` and `@upcoming` on the dashboard so each region fetches and streams on its own, and `@modal` for the report dialog. Every slot needs a `default.tsx` for URLs it cannot match.

**What are intercepting routes? What happens on refresh?**
`(.)feedback/[id]` inside `@modal` intercepts a soft navigation to `/feedback/[id]` and renders the report as a dialog over the current page. A hard load, a refresh or a shared link has no "current page" to overlay, so Next renders the real `feedback/[id]/page.tsx` instead. Same URL, two presentations.

**What is the difference between a Server Component and a Client Component, and where is your boundary?**
Server Components run only on the server, can read the database and ship no JavaScript. Client Components (`"use client"`) hydrate in the browser and can hold state and handle events. Our pages and layouts are all server; the client components are leaves: forms, the slot picker, the interview room, the dialog and menu. Server Components pass them plain serialisable props (DTOs).

**What do `loading.tsx`, `error.tsx` and `not-found.tsx` do?**
`loading.tsx` becomes a Suspense fallback for its segment. `error.tsx` is a client-side error boundary for the segment, with a retry. `not-found.tsx` renders when `notFound()` is called or no route matches; we call it for unknown categories, for other people's records and for `/admin` as a non-admin.

**What is the development workflow?**
`npm run dev` (Turbopack, fast refresh), `npm run typecheck`, `npm run lint` (ESLint directly, since Next 16 removed `next lint`), `npm test`, `npm run build` to see the route table.

### Rendering and data fetching

**Which pages use which rendering strategy, and why?**
See the README table. In one line each: landing is ISR because its numbers change slowly; category pages are SSG because the six slugs are known; the sample report is static; everything behind login is SSR because it depends on the user; the booking form and interview room are client-rendered islands because their state lives in the browser.

**What exactly does `revalidate = 600` do?**
Stale-while-revalidate. The first request after build is served from the cache. After 600 seconds the next request still gets the cached page, and triggers a rebuild in the background; later requests get the new one. Nothing ever waits for the rebuild.

**`revalidatePath` or `revalidateTag`?**
`revalidatePath("/dashboard")` invalidates a route's cached output, which we use after a mutation for the pages that show the changed data. `revalidateTag("public-stats", "max")` invalidates every cache entry that carries that tag, even ones used by several routes. We use the tag for the landing-page counters because the data (a count) is not tied to one path.

**Why `unstable_cache` for the counters?**
They come from Prisma, not `fetch`, so `fetch` caching does not apply. `unstable_cache` wraps any async function with a cache key, tags and a revalidate time. Next 16 also has `"use cache"` behind a flag; we used the stable, syllabus-standard model.

**How do you fetch data in Server Components, and when do you fetch on the client?**
Server Components call `lib/data/*` directly, so there is no HTTP hop and no API to secure twice. We fetch from the client only where the browser drives the timing: `/api/slots` when the day changes, and the two slow AI calls, where the UI wants a progress state.

**What makes a page dynamic?**
Reading request-time data: `cookies()`, `headers()`, `searchParams`, or an uncached fetch. Our signed-in pages call `requireUser()`, which reads cookies, so they are rendered per request.

**What stops the list being stale after you book?**
The Server Action calls `revalidatePath` for `/interviews` and `/dashboard`, which invalidates the browser's Router Cache for those paths, so the next view fetches fresh data. The cancel button also uses `useOptimistic`, so the row disappears immediately and comes back if the action fails.

**What is `React.cache` used for?**
Per-request memoisation. `getCurrentUser` is wrapped in it, so the layout and the page can both ask who the user is without decoding the cookie twice.

### Route Handlers and Server Actions

**When did you use a Server Action and when a Route Handler?**
Actions for mutations triggered by our own UI that should refresh the page and work as forms: sign in, register, book, cancel, autosave, upload, role change. Handlers for reads that other clients could want (`/api/slots`, the REST resources), for calls where the browser wants to await a body with a spinner (the two AI calls), and for anything that needs HTTP semantics such as the 302 to a signed URL. Both call the same services.

**Is a Server Action secure? It looks like a function call.**
It is a public POST endpoint with a generated URL, so we treat it that way. Every action re-checks the session (`assertUser`), validates its input with Zod (`parseInput`) and is rate limited. Next.js also compares the `Origin` header with the host, and arguments are untrusted, so nothing is assumed from the form that rendered it.

**How does your file upload work?**
A `<form action>` posts `multipart/form-data`; the action receives a `File`. It checks size and extension, reads the bytes and checks the `%PDF-` signature (the MIME type is only a claim), uploads to a private Supabase bucket under a random name with the service-role key, upserts the `Resume` row, then deletes the old object. If the database write fails, the new object is removed. The body limit is raised to 5 MB in `next.config.ts`.

**What do `useActionState`, `useFormStatus` and `useOptimistic` do here?**
`useActionState` holds an action's last result, which is how forms show server-side field errors and keep working without JavaScript. `useFormStatus` powers `SubmitButton`, which shows a pending state without any state in the page. `useOptimistic` removes a cancelled booking from the list instantly.

**How do actions report errors?**
Services throw an `AppError` with a code. `runAction` catches it and returns `{ ok: false, error, fieldErrors }`; handlers turn the same error into JSON with the right status. Anything else is logged in full and shown as a generic message. Redirects work by throwing, so `runAction` rethrows Next's control-flow errors with `unstable_rethrow`.

**Does the UI use the PATCH route?**
No. The room autosaves through `saveAnswerAction`. `PATCH /api/interviews/:id` is the REST equivalent that calls the same `saveAnswer` service, so external clients and the API docs have the full resource. (The same is true for booking and cancelling.)

**Which HTTP status codes do you use?**
201 for create (with `Location`), 204 for the vitals beacon, 302 for the résumé download, 401 unauthenticated, 403 forbidden or cross-site, 404 not found or not yours, 409 conflicts (full slot, limit, wrong state), 422 validation, 429 rate limit, 502 and 503 for upstream failures. The table is in `docs/API.md`.

### Authentication and authorization

**How does sign-in work end to end?**
The form calls `loginAction`: Zod validates, two rate limits apply (per address and per email), `signIn("credentials")` runs the provider's `authorize`, which loads the user and verifies the bcrypt hash. Auth.js writes a signed JWT to an HttpOnly cookie, and the action redirects to a checked `callbackUrl`.

**Why JWT sessions rather than database sessions?**
Auth.js requires the JWT strategy for the Credentials provider, and a JWT saves a query per request. The cost is that a session cannot be revoked instantly and its copy of the role can be stale, which is why anything that matters re-reads the role from the database.

**How is RBAC enforced?**
Four places, each sufficient alone: `proxy.ts` (cookie exists), layouts and pages (`requireUser`), actions and handlers (`assertUser` / `assertRole`), and the queries themselves (`WHERE userId = ...`). `/admin` calls `assertRole("ADMIN")`, which reads the role from the database, and answers 404.

**If the layout checks the session, why does every page check it too?**
Layouts are not re-rendered when you navigate between pages that share them, so a check that lives only in a layout can be skipped on a client-side navigation. `getCurrentUser` is cached per request, so asking again is free.

**What stops an open redirect or user enumeration?**
`safeCallbackUrl` only accepts paths that start with a single `/` and contain no backslash or control character (browsers delete tabs and newlines inside a URL, so `/\t/evil.example` would turn into `//evil.example`). The login error is one generic message, and for an unknown email we still run a bcrypt compare against a dummy hash so timing does not reveal which accounts exist. Registration does say "already exists", which is a conscious trade-off noted in `services/account.ts`.

**How are passwords stored?**
bcrypt with cost 12 (`lib/auth/password.ts`). Zod requires 8 to 72 characters with a letter and a number, and at most 72 bytes; 72 because bcrypt ignores anything longer, and a non-English letter takes 2 to 4 bytes.

### Database and Prisma

**Explain the schema.**
`User` owns many `Interview`s and at most one `Resume`. An `Interview` has at most one `Feedback`. `Feedback.interviewId` and `Resume.userId` are unique, which is how "one-to-one" is expressed. Auth.js adds `Account`, `Session` and `VerificationToken`. Cascades delete a user's data; deleting a résumé only nulls `Interview.resumeId`.

**What changed in Prisma 7 that affected you?**
The datasource `url` moved out of `schema.prisma` into `prisma.config.ts`; the client needs a driver adapter (`@prisma/adapter-pg`) and the new `prisma-client` generator writes TypeScript into `src/generated/prisma`, which is git-ignored and rebuilt on install.

**Why two connection strings?**
Supabase's transaction pooler (6543) suits many short serverless connections but cannot run migrations safely; the session pooler (5432) can. `DATABASE_URL` is for the app, `DIRECT_URL` for `prisma migrate`.

**How do you prevent double booking?**
A serializable transaction that counts and inserts together, with a retry on serialization failure. Without it, "count then insert" lets two requests both pass. A unique constraint cannot express "at most three". See the live demo above.

**Why is there one raw SQL statement?**
Autosave. Read-modify-write on the transcript JSON loses an answer when two saves overlap. `jsonb_set` patches one key atomically in the database. It is a tagged template, so values are parameters, and the `WHERE` clause also requires the right user and `IN_PROGRESS` status.

**Why JSON columns for the transcript and report?**
They are always read and written as whole documents and their shape evolves with the prompts. The score, the one field we sort and average, is a real column. Zod validates the JSON on write and on read.

**Which indexes did you add and why?**
`Interview(userId, status, scheduledAt)` for "my interviews" and the active-bookings count, `Interview(scheduledAt, status)` for seat counts, `Feedback(createdAt)` for recent reports.

**`migrate dev` or `migrate deploy`?**
`dev` creates and applies migrations while developing (and can reset); `deploy` only applies existing migrations and is what production and CI use.

**How do you avoid N+1 queries?**
Each list is one `findMany` with a `select` that includes the related score, plus parallel counts. Mappers turn rows into DTOs without further queries.

### AI integration

**How do you get reliable JSON from Gemini?**
Three layers: `responseMimeType: application/json` with a `responseJsonSchema`; a tolerant parser (it strips a code fence); then Zod validation. If validation fails, one repair call lists the exact problems back to the model. If that fails too, the offline evaluator answers. A test keeps the JSON Schema and the Zod schema in step.

**What if the model lies or the quotes do not match?**
Annotations are quotes from the answer. `lib/annotate.ts` finds them tolerantly (case, whitespace, curly quotes, ellipses). A quote it cannot find is shown as a note beside the answer rather than silently dropped, so nothing the model said is invented into the highlight.

**How do you handle prompt injection?**
Candidate text is fenced in tags and the system prompt says it is data, not instructions. `fence()` strips lookalike tags from the answer. The model has no tools, and the server decides everything that matters: blank answers are forced to zero, the overall score is computed here, and the output must match a schema. The worst a successful injection can do is change that user's own report.

**Why is the overall score computed on the server?**
Models are unreliable at arithmetic and can be argued with. The model scores each answer 0 to 10; `overallScore` is `round(mean × 10)`, and the readiness band is derived from it.

**What if Gemini is down?**
Calls time out within a shared budget (50 seconds, under the 60-second route limit). With `AI_FALLBACK=true` the offline rubric evaluator produces the report, and `Feedback.model` records that, so the report is honest about its source. With the flag off, the user sees a clear error and can retry; the interview stays in progress.

**Why `fetch` and not the Google SDK?**
It is one POST. A hand-written client keeps dependencies down and puts headers, body and error mapping in one readable file. It also made the structured-output fallback (retry without the schema field if the API rejects it) trivial.

**The FAQ says Gemini 1.5 Flash. Why `gemini-3.8-flash`?**
Google retired the 1.5 models, so the call would return 404. The model name is an environment variable (`GEMINI_MODEL`), so it can change without touching code, and the offline evaluator keeps the product usable regardless.

**Is the evaluation deterministic?**
No, it is a language model call (temperature 0.4). The prompt asks for consistency and the rubric and key points anchor it, but two runs can differ by a point or two. We say so rather than claim otherwise.

### Performance, SEO and deployment

**What did you do for performance?**
Static, ISR and streaming where possible; `next/dynamic` for the chart; `next/font` (no layout shift, no request to Google); `next/image` for the avatar; very little client JavaScript; hand-drawn SVG charts instead of a charting library; Core Web Vitals collected in production.

**What did you do for SEO?**
The Metadata API with a title template, descriptions, canonical URLs, Open Graph and Twitter cards; `generateMetadata` and JSON-LD breadcrumbs on category pages; a generated Open Graph image, sitemap and robots file that keeps signed-in routes out of the index; semantic HTML and one `h1` per page.

**How would you deploy it?**
Push to GitHub, import in Vercel, set the environment variables, run `npm run db:deploy` once against the production database, deploy. Steps and troubleshooting are in `docs/DEPLOYMENT.md`.

**How do you monitor it?**
Structured JSON logs with request ids, `onRequestError` for uncaught errors, Core Web Vitals lines from `/api/vitals`, and `/api/health` for an uptime check.

**What can the Edge runtime not do, and why is `/api/health` on it?**
It has only Web APIs: no TCP sockets (so no `pg` or Prisma) and no Node-only modules. A liveness probe needs none of that, so it can start in milliseconds at the edge. Everything that touches the database stays on Node.

### Security and testing

**What are your main security measures?**
See the table in `docs/ARCHITECTURE.md` section 12: server-only secrets, parameterised SQL, Zod on every input, Origin checks, security headers, bcrypt, rate limits, file checks, private bucket with short-lived links, ownership filters on every query, redacted logs.

**What do your tests cover, and what do they not?**
91 unit tests on the logic that is easy to get subtly wrong: slot and timezone rules, status transitions, scoring, the highlighter, validation, the rate limiter, transcript merging, reconcile, and the Gemini schema contract. They need no database. They do not cover the live database, Gemini or Supabase; the booking race and autosave SQL were checked by hand on PostgreSQL 16, and an integration suite against a real database is the next thing to add.

### Honest answers

**Did you implement internationalization?**
No. It was out of scope and the UI is English only. The Next.js way would be a `[locale]` segment at the top of `app/`, a `proxy.ts` rule that reads `Accept-Language` and redirects `/` to `/en`, one dictionary file per language loaded in Server Components, `generateStaticParams` for the locale list, `lang` set on `<html>`, and `Intl` for dates and numbers. Our date formatting already goes through `Intl.DateTimeFormat` in `lib/format.ts`, which is the part that is hardest to retrofit.

**Did you implement voice or video answers?**
No. Typed answers keep the AI step deterministic and testable, and the report can quote exact sentences. Voice would add speech-to-text before the same pipeline.

**Why dark only?**
The brief asked for a polished dark design. One finished theme beats two half-finished ones; the colours are CSS variables, so a light theme is a second set of values rather than a rewrite.

**Did you run the shadcn CLI?**
The UI kit follows the shadcn/ui structure (Radix primitives, `class-variance-authority`, `tailwind-merge`, `components.json`) and lives in `src/components/ui`. The components were written by hand to fit our design tokens, and `npx shadcn add` still works for more.

**Is the offline evaluator "AI"?**
No, and the report says so (`candor-rubric-v1`). It scores against the rubric of the built-in question bank so the product demos without a key and survives an outage.

**What is the weakest part?**
The in-memory rate limiter (per instance), the missing integration tests, no CSP yet, and an offline evaluator that is a heuristic. All are listed in `docs/ARCHITECTURE.md` under Known limits, with the fix for each.

**What would you do with another week?**
Redis rate limiting, a nonce-based CSP, Testcontainers integration tests including the booking race, email verification and reminders, i18n, streaming the evaluation so the report appears as it is written, and a timer per question.

---

## Numbers to remember

| Thing | Value |
| --- | --- |
| Slots | 10:00 to 18:00 IST, 30 minutes, 16 per day |
| Seats per slot | 3 |
| Upcoming bookings per person | 5 |
| Booking horizon | today plus 13 days |
| Slot closes for booking | 30 minutes before it starts |
| Room opens | 10 minutes before the slot (any time in `DEMO_MODE`) |
| Questions per session | 5, easiest first |
| Answer length | up to 4,000 characters; under 3 words counts as blank |
| Score | per answer 0 to 10; overall 0 to 100 = round(mean × 10); below 50 needs work, below 75 on track, otherwise interview ready |
| Competencies | technical accuracy, depth, problem solving, communication, structure |
| Résumé | PDF, 4 MB, one per user, 60-second signed download |
| Session cookie | JWT, 7 days; bcrypt cost 12; password 8 to 72 characters |
| ISR | `revalidate = 600` on `/` |
| AI limits | 45 s per call, 50 s shared budget, route `maxDuration = 60` |
| Rate limits | login 8 per 15 min per email, 20 per IP; register 6 per hour; book 10 per min; autosave 120 per min; start 8 per min; evaluate 5 per 10 min; résumé 6 per min |
| Counts | 11 Route Handlers, 10 Server Actions, 6 categories, 91 tests |

## Files worth opening

1. `src/lib/services/booking.ts` — the serializable transaction and the conditional cancel
2. `src/lib/services/session.ts` — the state machine, `jsonb_set` autosave, idempotent submit
3. `src/lib/ai/index.ts`, `reconcile.ts`, `prompts.ts` — the AI pipeline
4. `src/actions/resume.ts` and `src/lib/services/resume.ts` — the Server Action upload
5. `src/app/(marketing)/page.tsx` and `categories/[slug]/page.tsx` — ISR and SSG
6. `src/app/(app)/dashboard/layout.tsx` and `(app)/@modal/(.)feedback/[id]/page.tsx` — parallel and intercepting routes
7. `src/proxy.ts`, `src/lib/auth/auth.ts`, `src/lib/auth/session.ts` — auth
8. `prisma/schema.prisma` and the migration
9. `src/lib/http.ts`, `src/lib/action.ts`, `src/lib/errors.ts` — one error model, two entry points
10. `src/app/api/health/route.ts` — Edge runtime
11. `tests/ai-contract.test.ts` — keeping two schemas honest

## Pre-flight and if something breaks

**Thirty minutes before:** run `npm run db:seed` for a clean demo state; sign in as all three demo users once; make one full session as the student so the app is warm; open `/api/health`; check `DEMO_MODE=true`; close other heavy apps; have the DEPLOYMENT checklist's smoke test passed on this exact machine and network.

| If | Then |
| --- | --- |
| Gemini is slow or errors | The fallback produces a report anyway (`candor-rubric-v1`). Say so. Or set `AI_MODE=mock`, restart, and continue. |
| The slot is "too early" | `DEMO_MODE=true` in `.env`, restart the dev server. |
| The database is unreachable | Check Wi-Fi, then the Supabase project is not paused. Fall back to a local PostgreSQL with `DATABASE_SSL=disable`, run `db:deploy` and `db:seed`. |
| Résumé upload fails | Check `SUPABASE_URL` and the service-role key; skip the demo step and show the code and the rejection of a fake PDF in the unit tests. |
| You are asked something you do not know | Say what the file does, open it, and reason from it. Examiners reward that more than a guess. |
