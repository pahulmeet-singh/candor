# Candor

**An AI mock interview platform.** Book a 30-minute slot, answer five questions in your own words, and get a report that points at the exact sentences that worked and the ones that did not.

Built for **INT257 · Modern Web Application Development** with the Next.js App Router, Prisma, Supabase and Gemini.

> Everything the course asks for is used for a reason, not to tick a box: a rendering strategy is picked per page, mutations are Server Actions, reads that other clients may want are Route Handlers, and the database rules live in one service layer that both entry points share. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains each choice.

---

## What you can do

| Area | What it does |
| --- | --- |
| **Categories** | Six interview rounds: Frontend, Backend & APIs, Data structures & algorithms, System design, Behavioural, Full-stack Next.js. Each has its own question bank at three difficulty levels. |
| **Slot booking** | 30-minute slots, 10:00 to 18:00 IST, for the next 14 days. Three seats per slot, at most five upcoming bookings per person. Two people grabbing the last seat at the same moment cannot both get it. |
| **Interview room** | Five questions, easiest first, typed answers with autosave and a live clock. With Gemini switched on, questions can be tailored to your résumé. |
| **Feedback report** | A score out of 100, five competency scores, and every answer shown with the sentences that were strong or weak highlighted, plus a model answer. Reports open as a dialog from the list and as a full page when linked directly. |
| **Dashboard** | Your score trend, upcoming sessions and totals. Each block streams in on its own. |
| **Résumé upload** | One PDF per user, checked on the server and stored in a private Supabase bucket. Downloads use a link that expires after 60 seconds. |
| **Admin** | Platform totals and role management, guarded by role-based access control. |

Not included, on purpose: see [Scope](#scope).

## Stack

| Layer | Choice | Why this one |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router), React 19 | The course subject. Uses `proxy.ts` (Next 16's name for middleware), parallel and intercepting routes, and the async `params` / `searchParams` API. |
| Database | **PostgreSQL on Supabase** through **Prisma 7** | Prisma gives typed queries and migrations; the `pg` driver adapter lets the app use Supabase's pooled port. |
| Auth | **Auth.js v5** (`next-auth`) | Credentials sign-in, optional Google, JWT sessions in an HttpOnly cookie. |
| File storage | **Supabase Storage** | Private bucket, server-side service-role key, short-lived signed URLs. |
| AI | **Google Gemini** over `fetch`, structured JSON output | One POST per call. The reply is validated with Zod and the overall score is computed on the server. An offline evaluator runs when no key is set. |
| Validation | **Zod 4** | The same schemas validate forms, Server Actions, Route Handlers and the AI's JSON. |
| UI | **Tailwind CSS 4**, shadcn-style components (Radix primitives + `cva`) | Dark-only design with its own identity: deep teal ground, cream text, serif for reading, highlighter yellow for emphasis. |

## Quick start

You need **Node 22.12 or newer** (`nvm use` reads `.nvmrc`) and a **Supabase** project (the free tier is enough).

```bash
# 1. Install. This also runs `prisma generate`.
npm install

# 2. Configure. (Windows PowerShell: Copy-Item .env.example .env   Command Prompt: copy .env.example .env)
cp .env.example .env
#    Fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET and the Supabase keys.
#    Every variable is explained in .env.example and in docs/DEPLOYMENT.md.

# 3. Create the tables and load demo data.
npm run db:deploy
npm run db:seed

# 4. Run it.
npm run dev            # http://localhost:3000
```

**Demo accounts** (created by the seed, password `Password123!`):

| Email | Role | What it has |
| --- | --- | --- |
| `student@candor.test` | User | Six past reports with a rising score trend and upcoming bookings. Use this for the walkthrough. |
| `rohan@candor.test` | User | Two reports. Use it as the second person when showing seat limits. |
| `admin@candor.test` | Admin | One report, plus the `/admin` page. |

**No Gemini key?** Leave `GEMINI_API_KEY` empty. The app then uses an offline rubric evaluator, so the whole flow works and the report page still shows real highlights. Add a key and it switches to Gemini on its own; `AI_MODE=mock` forces the offline mode.

**Demoing outside slot hours?** `DEMO_MODE=true` (the default in `.env.example`) lets a booked interview start at any time, so you do not have to wait for the slot.

**No Supabase yet?** Everything except résumé upload works against any PostgreSQL. For a local database set `DATABASE_SSL=disable` and point both `DATABASE_URL` and `DIRECT_URL` at it.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Supabase connection (port 6543) used by the running app. |
| `DIRECT_URL` | yes | Session-pooler connection (port 5432) used by Prisma migrations. |
| `DATABASE_SSL` | no | Set to `disable` for a local Postgres without TLS. |
| `AUTH_SECRET` | yes | Signs the session cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | no | Enable "Continue with Google". The button only renders when both are set. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | for résumés | Server-only. Put Supabase's secret key (`sb_secret_…`, from Settings → API Keys) in `SUPABASE_SERVICE_ROLE_KEY`; the legacy `service_role` key works too. It bypasses row-level security and must never get a `NEXT_PUBLIC_` prefix. |
| `SUPABASE_RESUME_BUCKET` | no | Bucket name, default `resumes`. Created as a private bucket on first upload. |
| `AI_MODE` | no | `gemini`, `mock`, or empty to choose automatically from whether a key exists. |
| `GEMINI_API_KEY` | for real AI | From Google AI Studio. |
| `GEMINI_MODEL` | no | Default `gemini-3.8-flash`. It is a variable because model names get retired. |
| `AI_FALLBACK` | no | Default `true`: if Gemini fails, use the offline evaluator instead of failing the request. |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL for metadata, sitemap and Open Graph. |
| `DEMO_MODE` | no | `true` lets scheduled interviews start at any time. Turn it off in production. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | `prisma generate` then `next build`. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint (`eslint .`; Next 16 removed `next lint`). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Unit tests with Node's built-in runner through `tsx`. No database needed. |
| `npm run db:migrate` | Create and apply a migration in development. |
| `npm run db:deploy` | Apply existing migrations (use this on a fresh database and in production). |
| `npm run db:seed` | Load the demo users and sessions. Safe to run repeatedly. |
| `npm run db:reset` | Drop everything, re-apply migrations, re-seed. |
| `npm run db:studio` | Browse the data in Prisma Studio. |

## Where each rendering strategy is used

| Route | Strategy | Why |
| --- | --- | --- |
| `/` | **ISR** (`revalidate = 600`) plus a tagged Data Cache entry | The public counters change slowly. The page is served from the CDN and rebuilt in the background; `revalidateTag` refreshes the numbers the moment a report is saved. |
| `/categories` | **Static** | No data and no cookies, so it is built once. |
| `/categories/[slug]` | **SSG** (`generateStaticParams`, `dynamicParams = false`) | The six slugs are known at build time. An unknown slug is a 404 without running any code. |
| `/sample-report` | **Static** | A fixture report for visitors who are not signed in. |
| `/login`, `/register` | **SSR** shell, **client** forms | The layout reads the session to bounce signed-in users; the forms use `useActionState`. |
| `/dashboard` | **SSR** with **parallel routes** (`@stats`, `@trend`, `@upcoming`) | Per-user data, so never cached. Each slot has its own `loading.tsx`, so the three blocks stream in independently. |
| `/interviews`, `/feedback` | **SSR**, state in the URL (`?tab=`, `?page=`, `?category=`, `?range=`, `?sort=`) | Tabs and pages are plain links and the filter is a GET form, so they work without JavaScript and can be shared. |
| `/interviews/new` | SSR page, **CSR** booking form | Picking a day fetches `/api/slots`; booking calls a Server Action. |
| `/interviews/[id]/session` | SSR page, **CSR** room | Typing, autosave and the countdown are client state. |
| `/feedback/[id]` | **SSR** full page, or **intercepted** as a modal | `@modal/(.)feedback/[id]` shows the report as a dialog over the list. A direct visit or refresh renders the full page. |
| `/admin` | **SSR**, role checked against the database | Answers 404 to non-admins. |
| `/api/health` | **Edge runtime** | A liveness probe needs no database, so it can run at the edge. Everything else stays on Node. |

## Project structure

```
prisma/
  schema.prisma          User, Account, Session, VerificationToken (Auth.js) + Resume, Interview, Feedback
  migrations/            SQL, applied with `prisma migrate deploy`
  seed.ts                Demo users, history and upcoming bookings
src/
  proxy.ts               Next 16 proxy: optimistic login redirect + request ids
  instrumentation.ts     Error logging hook (onRequestError)
  app/
    (marketing)/         Public pages: landing (ISR), categories (SSG), sample report
    (auth)/              Login and register
    (app)/               Signed-in area: dashboard, interviews, feedback, résumé, admin
      @modal/            Parallel slot that holds the intercepted report dialog
    api/                 Route Handlers (see docs/API.md)
  actions/               Server Actions: auth, interviews, résumé, admin
  components/
    ui/                  shadcn-style primitives
    shared/ layout/ ...  Feature components, Server by default, Client only where needed
  lib/
    services/            Business rules and transactions (booking, session, résumé, admin, account)
    data/                Read queries that return plain DTOs
    ai/                  Prompts, Gemini client, JSON schemas, reconciliation, offline evaluator
    validations/         Zod schemas
    constants/           Categories, competencies, limits, question bank
    slots.ts status.ts scoring.ts annotate.ts    Pure logic with unit tests
tests/                   Node test runner
docs/                    Architecture, API, deployment, viva notes
```

The rule that holds the structure together: **actions and route handlers are thin**. They check who is calling, validate input with Zod, call one function in `lib/services`, then revalidate caches. Services hold the rules and talk to Prisma. Data functions return plain objects (dates as ISO strings, never a password hash), so nothing sensitive can leak into a Client Component by accident.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The tests cover the logic that is easy to get subtly wrong: slot generation across the IST/UTC boundary, status rules, the scoring maths, the answer highlighter, validation schemas, the rate limiter, transcript merging, and the contract between the JSON Schema sent to Gemini and the Zod schema that checks the reply. They run without a database or network.

## Scope

**Implemented:** everything in the table at the top, plus security headers, rate limiting, request ids and structured logs, Core Web Vitals logging, Open Graph image, sitemap and robots.

**Not implemented, deliberately:**

- **Internationalization.** The interface is English only. Adding it means a `[locale]` segment plus a dictionary per language; `proxy.ts` is where locale negotiation would go.
- **Voice or video answers.** Answers are typed, which keeps the AI step deterministic and testable.
- **Light theme.** The design is dark only; there is no theme toggle.
- **Email notifications and calendar invites.**
- **A shared rate-limit store.** Limits are per server instance (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limits)).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, data model, rendering and caching, booking concurrency, the AI pipeline, security, trade-offs.
- [docs/API.md](docs/API.md): every Route Handler and Server Action with request and response shapes.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Supabase and Vercel setup, environment, first-run checklist, troubleshooting.
- [docs/VIVA_CHEAT_SHEET.md](docs/VIVA_CHEAT_SHEET.md): syllabus-to-code map and likely viva questions with answers.
# candor
