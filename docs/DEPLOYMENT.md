# Deployment and first run

This guide takes you from an empty folder to a running Candor, locally and on Vercel. It also lists what to check on the first run, because the first `npm install` on a new machine is where version drift shows up.

- [What you need](#what-you-need)
- [1. Supabase](#1-supabase)
- [2. Configure the environment](#2-configure-the-environment)
- [3. First run checklist](#3-first-run-checklist)
- [4. Deploy to Vercel](#4-deploy-to-vercel)
- [5. Reading the build output](#5-reading-the-build-output)
- [6. Logs and monitoring](#6-logs-and-monitoring)
- [7. Before real users](#7-before-real-users)
- [Troubleshooting](#troubleshooting)

---

## What you need

| Thing | Needed for | Cost |
| --- | --- | --- |
| Node.js 22.12 or newer | Everything (`.nvmrc` pins 22) | free |
| A Supabase project | PostgreSQL and résumé storage | free tier is enough |
| A Gemini API key from Google AI Studio | Real AI feedback | optional; without it the offline evaluator is used |
| A Google OAuth client | "Continue with Google" | optional |
| A Vercel account | Hosting | free tier is enough |

## 1. Supabase

1. Create a project at supabase.com. Remember the database password; you need it for the connection strings.
2. **Connection strings.** Click the **Connect** button at the top of the project page and copy two of the strings, replacing `[YOUR-PASSWORD]`. Copy them whole instead of typing the host yourself: the pooler host contains a number (`aws-0-…`, `aws-1-…`) that you cannot work out from your region. A password made of letters and digits avoids URL-encoding problems.
   - **Transaction pooler** (port **6543**). This is `DATABASE_URL`, used by the running app. Add `?pgbouncer=true` at the end if it is not there. The app removes that parameter itself before connecting, because only Prisma's old engine understood it.
   - **Session pooler** (port **5432**, host `aws-<n>-<region>.pooler.supabase.com`). This is `DIRECT_URL`, used by `prisma migrate`, because migrations need a session that can run DDL. Use the pooler host rather than `db.<ref>.supabase.co`: the direct host is IPv6 only on the free tier and many home and campus networks cannot reach it.
3. **Secret key.** Open *Settings, API Keys* and copy the **secret key** (it starts with `sb_secret_`) into `SUPABASE_SERVICE_ROLE_KEY`. The older `service_role` key from the *Legacy* tab works in the same variable. For `SUPABASE_URL` use `https://<project-ref>.supabase.co`; the project ref is the part after `postgres.` in your connection string and the last part of the dashboard address. This key bypasses row-level security. It lives only in server environment variables and is never prefixed `NEXT_PUBLIC_`.
4. **Storage.** Nothing to click. The first résumé upload creates a **private** bucket named by `SUPABASE_RESUME_BUCKET` (default `resumes`), limited to PDFs up to 4 MB. You can create it by hand first (*Storage, New bucket*, leave "Public bucket" off) if you prefer.

Because the bucket is private and only the server holds the key, nobody can list or fetch résumés except through `GET /api/resume/:id/download`, which signs a 60-second link after checking ownership.

## 2. Configure the environment

```bash
cp .env.example .env
```

Fill in at least `DATABASE_URL`, `DIRECT_URL` and `AUTH_SECRET` (generate it with `openssl rand -base64 32`). The full table of variables is in the [README](../README.md#environment-variables).

Leave `GEMINI_API_KEY` empty to start; the app uses its offline evaluator and everything works. Add the key later (and optionally `GEMINI_MODEL`) to switch to real feedback.

**Using a local PostgreSQL instead of Supabase** (no résumé upload, everything else works):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/candor"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/candor"
DATABASE_SSL="disable"
```

## 3. First run checklist

Run these in order on your own machine. Each step tells you something different, and the order means the cheapest failure shows up first.

```bash
nvm use                 # Node 22
npm install             # also runs `prisma generate` (creates src/generated/prisma)
npm run typecheck       # 1. types against the real Next, Prisma and Auth.js packages
npm run lint            # 2. ESLint with the Next 16 config
npm test                # 3. unit tests, no database needed
npm run db:deploy       # 4. create the tables (needs DIRECT_URL)
npm run db:seed         # 5. demo users and sessions
npm run build           # 6. production build
npm run dev             # 7. then walk through the smoke test below
```

**Why this order.** `typecheck`, `lint` and `test` need no database, so they fail fast and name the file and line of any problem. The database steps come next because the landing page reads its public counters while it is built (if the database is unreachable it simply renders without them). `build` last proves the whole app compiles and prints the route table used in [section 5](#5-reading-the-build-output).

Versions are pinned in `package.json` (Auth.js exactly, the rest with a caret). If a later minor release of Next.js, Prisma or Auth.js changes a signature, `npm run typecheck` shows where. Run the whole checklist once, on the machine you will present from, **before** the viva day.

### Smoke test (about five minutes)

| # | Do this | You should see |
| --- | --- | --- |
| 1 | Open `/` | Landing page with live counters; scroll shows the sample report and six categories |
| 2 | Open `/categories/backend`, then `/categories/nope` | A static category page, then the 404 page |
| 3 | Open `/dashboard` while signed out | Redirect to `/login?callbackUrl=/dashboard` |
| 4 | Sign in as `student@candor.test` / `Password123!` | Dashboard with a rising score trend, three blocks streaming in |
| 5 | `/interviews/new`: pick a category, a day, a slot, book | Toast "Interview booked", row appears under *Upcoming* |
| 6 | Open it and start the session (`DEMO_MODE=true`) | Five questions; type an answer, see "Saved" after about a second |
| 7 | Submit | A report with a score ring, radar and highlighted sentences |
| 8 | Back on `/feedback`, click a report | It opens as a dialog; refresh the page and it becomes a full page |
| 9 | `/resume`: upload a PDF, then a `.txt` renamed to `.pdf` | First is saved; second is refused ("does not look like a PDF") |
| 10 | `/admin` as the student, then as `admin@candor.test` | 404 first, then the admin page |
| 11 | `GET /api/health` | `{"status":"ok", ...,"runtime":"edge"}` |

If step 6 or 7 shows the report's model as `candor-rubric-v1`, the offline evaluator produced it, which is expected without a Gemini key.

## 4. Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework preset is detected as Next.js; leave the build command as `npm run build` (it runs `prisma generate` first) and the install command as the default.
2. Set the **Node.js version** to 22.x in *Settings, General*.
3. Add the environment variables under *Settings, Environment Variables* for **Production** (and Preview if you use it):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | transaction pooler string, port 6543 |
   | `DIRECT_URL` | session pooler string, port 5432 (not used at runtime, but harmless) |
   | `AUTH_SECRET` | the generated secret; keep it identical across deployments or everyone is signed out |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RESUME_BUCKET` | from Supabase |
   | `GEMINI_API_KEY`, `GEMINI_MODEL` | from Google AI Studio |
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` (used for metadata, sitemap and the Open Graph image) |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | only if you enable Google |
   | `DEMO_MODE` | `false` (or leave unset) for a real deployment; `true` for the viva |

4. **Run the migrations once**, from your own machine, against the production database:

   ```bash
   DIRECT_URL="<session pooler string>" npm run db:deploy
   ```

   Migrations are deliberately not part of the Vercel build: a failed migration should stop you before a deploy, not halfway through one. Seed data is for development; do not run `db:seed` against a database with real users (it only touches the three demo accounts, but there is no reason to create them in production).
5. **Google sign-in (optional).** In Google Cloud Console create an OAuth client of type *Web application* and add the authorised redirect URI `https://your-domain/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local use). Put the client id and secret in the two variables above. The button appears only when both are set.
6. Deploy. Then run the smoke test above against the live URL.

**Region.** Choose the Vercel function region closest to your Supabase region (for example Mumbai for `ap-south-1`) in *Settings, Functions*. Every page that touches the database makes several round trips; distance between the two is the biggest factor in how fast they feel.

**Function duration.** The two AI routes declare `maxDuration = 60`. Check that your Vercel plan allows it; if not, lower the constant in `src/app/api/interviews/[id]/questions/route.ts` and `.../evaluate/route.ts`. Inside that limit, a Gemini call is capped at 45 seconds and all attempts for one request (the first call and the one repair) share a 50-second budget; when it runs out the offline fallback takes over, so a session is not lost.

**Other hosts.** Any host with Node 22 can run `npm ci && npm run build && npm start`. Set the same variables and `PORT` as the host requires. `trustHost` is on in the Auth.js config, so it works behind a reverse proxy that forwards `Host` or `X-Forwarded-Host`.

## 5. Reading the build output

`next build` prints a table of routes. Use it in the viva to show that the rendering strategies are real, not just written in comments. Symbols you should see:

| Symbol | Meaning | Routes expected |
| --- | --- | --- |
| `○` Static | Prerendered once | `/categories`, `/sample-report`, `/sitemap.xml`, `/robots.txt`, the icon and Open Graph image |
| `○` with a **Revalidate** value | ISR | `/` with `10m` |
| `●` SSG | Prerendered from `generateStaticParams` | `/categories/[slug]` with the six slugs listed beneath it |
| `ƒ` Dynamic | Rendered on demand | everything under the signed-in area, `/login`, `/register`, all `/api/*` handlers |

`/api/health` is marked as running on the Edge runtime. If a route you expect to be static shows `ƒ`, something in it reads cookies, headers or `searchParams`; that is the first thing to look for.

You can also run `next start` after the build and confirm ISR by loading `/` and checking the `x-nextjs-cache` response header (`HIT`, then `STALE` after ten minutes while it regenerates in the background).

## 6. Logs and monitoring

- **Logs** are one JSON object per line on stdout. On Vercel, *Logs* can filter by text, so searching `request.error` finds every uncaught server error, `booking.serialization_retry` shows booking contention, `ai.repair` and `ai.evaluate.fallback` show how often the AI misbehaved, and `web-vital` lines carry Core Web Vitals.
- **Request ids.** Every response carries `x-request-id`. When a user reports "something went wrong", ask for the id in the error body or in the response header and search the logs for it.
- **Uptime.** Point an uptime monitor at `GET /api/health`. It is on the Edge runtime and does not touch the database, so it tells you the deployment is serving, not that the database is up; for that, load any signed-in page or add a database ping.
- **Error tracking.** `src/instrumentation.ts` is where Sentry or OpenTelemetry would be registered. It currently logs through `onRequestError`.

## 7. Before real users

Candor is a course project that is built to a production standard in most places; these are the known gaps, in order of importance. The full list is in [ARCHITECTURE.md](ARCHITECTURE.md#known-limits).

1. Set `DEMO_MODE=false`.
2. Replace the in-memory rate limiter with a shared store (Upstash Redis), since each serverless instance counts separately.
3. Add a Content-Security-Policy with per-request nonces in `proxy.ts`.
4. Pin Supabase's CA certificate and turn certificate verification on in `lib/prisma-client.ts`.
5. Add email verification and password reset.
6. Rotate the service-role key if it was ever pasted anywhere other than the host's secret store, and enable Supabase backups.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `npm install` fails with `No matching version found for <package>@<range>` | A version range in `package.json` names a release that is not on npm. Run `npm view <package> versions --json`, pick the closest release, edit `package.json` and install again. Keep `next-auth` and `@auth/prisma-adapter` on the exact versions they are pinned to unless `npm run typecheck` is clean afterwards. |
| `npm run typecheck` reports a handful of errors the first time | The first run against the real Next, Prisma and Auth.js packages can disagree with a signature the code assumed. Each error names a file and line and is normally a one-line change; fix them before the viva, then re-run the whole checklist. |
| `npm run lint` flags `react-hooks/...` rules (`set-state-in-effect`, `refs`, `purity`) | Those come from the React Compiler rule set that `eslint-config-next` 16 turns on. They do not stop `next build`. Fix the flagged line (the message says how), or switch that single rule off in `eslint.config.mjs` if you are short of time. |
| `Cannot find module '@/generated/prisma/client'` or types missing for `PrismaClient` | The client has not been generated. Run `npx prisma generate` (it also runs on `npm install` and `npm run build`). |
| `P1001: Can't reach database server` | Wrong host or port, or an IPv6-only direct host. Use the **pooler** hostnames from the Connect dialog. A paused free project must be restored first. |
| `P1000` or `password authentication failed` | The password in the string is wrong, or contains characters that need URL-encoding (`@`, `/`, `#`). Encode it. |
| `self-signed certificate in certificate chain` against a *local* database | Set `DATABASE_SSL=disable`. |
| `MissingSecret` from Auth.js, or being signed out after every restart | `AUTH_SECRET` is missing or changes between runs. Set a fixed value. |
| Sign-in works locally but fails on the deployed site | `NEXT_PUBLIC_APP_URL` or the Google redirect URI still points at localhost. |
| Redirect loop between `/login` and `/dashboard` | A stale cookie from another secret. Clear cookies for the site. (`proxy.ts` is built not to cause this; it only checks that a cookie exists.) |
| Résumé upload says storage is not configured | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both required. |
| Résumé upload says "We could not reach file storage" | Check the secret or service-role key (not the publishable or anon key) and that the bucket name has no spaces or capitals. The log line `storage.failed` has the underlying error. |
| Report page shows `candor-rubric-v1` as the model although a key is set | Gemini failed and the offline evaluator took over. Search the log for `ai.evaluate.fallback`. Set `AI_FALLBACK=false` temporarily to see the real error. |
| Gemini returns 404 for the model | The model name was retired. Set `GEMINI_MODEL` to a current Flash model from AI Studio. |
| `Module not found: Can't resolve 'server-only'` | Run `npm install`; the package is listed in `dependencies`. |
| Booking says "Many people are booking right now" | Three serialization retries failed in a row. It is the intended response to extreme contention; try again. |
| Port 3000 is busy | `npm run dev -- -p 3001`, and update `NEXT_PUBLIC_APP_URL` and any OAuth redirect URI. |
| Want a clean slate | `npm run db:reset` drops all data, re-applies migrations and re-seeds. |
