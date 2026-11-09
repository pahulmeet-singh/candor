import type { BankQuestion } from "./types";

export const FULLSTACK_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "fs-01",
    difficulty: "BEGINNER",
    topic: "App Router and layouts",
    text: "How does the Next.js App Router turn folders into routes, and what do page.tsx, layout.tsx and loading.tsx do?",
    rubric: [
      { label: "Folders inside app/ define URL segments, and page.tsx makes a segment publicly routable", anyOf: ["folder", "segment", "file-system", "file system", "page.tsx", "route"], min: 2 },
      { label: "layout.tsx wraps pages in shared UI that persists across navigation", anyOf: ["layout", "shared", "persist", "nested", "does not re-render", "keeps state"], min: 2 },
      { label: "loading.tsx is the Suspense fallback that streams in while the page loads", anyOf: ["loading", "suspense", "stream", "skeleton", "fallback"] },
      { label: "Mentions dynamic segments, route groups or error and not-found files", anyOf: ["[id]", "dynamic segment", "route group", "error.tsx", "not-found", "(group)"] },
    ],
    modelAnswer:
      "In the App Router every folder under app/ is a URL segment, and a page.tsx inside it makes that segment publicly routable. A layout.tsx wraps its pages and child routes in shared UI such as a navbar; layouts are nested and persist across navigations, so they do not re-render and keep their state. loading.tsx is an automatic Suspense fallback, so the shell streams in while the page's data loads. Dynamic segments like [id], route groups in parentheses, error.tsx and not-found.tsx complete the model.",
  },
  {
    id: "fs-02",
    difficulty: "BEGINNER",
    topic: "Server vs Client Components",
    text: "What is the difference between a Server Component and a Client Component in Next.js, and when do you add 'use client'?",
    rubric: [
      { label: "Server Components are the default, render on the server and ship no component JavaScript to the browser", anyOf: ["default", "on the server", "no javascript", "less javascript", "zero javascript", "bundle"], min: 2 },
      { label: "Server Components can read the database and secrets directly and can be async", anyOf: ["database", "secret", "async", "await", "directly", "fetch data"], min: 2 },
      { label: "Client Components are needed for state, effects, event handlers and browser APIs", anyOf: ["usestate", "useeffect", "state", "event handler", "onclick", "browser api", "interactiv"], min: 2 },
      { label: "Keeps the client boundary small and passes data as props", anyOf: ["boundary", "small", "leaf", "props", "serializ", "push it down", "as low as"] },
    ],
    modelAnswer:
      "In the App Router every component is a Server Component by default: it renders on the server and ships no JavaScript for itself to the browser. Because it runs on the server, it can be async, await a database query and use secrets directly. I add 'use client' only when a component needs state, effects, event handlers or browser APIs, such as a form with live validation or a dropdown. I keep that client boundary small, near the leaves, and pass server-fetched data down as serialisable props.",
  },
  {
    id: "fs-03",
    difficulty: "BEGINNER",
    topic: "Data access with an ORM",
    text: "What is an ORM such as Prisma, and why use it instead of writing raw SQL everywhere?",
    rubric: [
      { label: "Maps database tables to typed models and objects in code", anyOf: ["map", "model", "object", "table", "schema.prisma", "typed"], min: 2 },
      { label: "Type safety and autocomplete catch mistakes at compile time", anyOf: ["type-safe", "type safe", "typescript", "autocomplet", "compile", "types"] },
      { label: "Migrations keep the schema in version control, and queries are parameterised against SQL injection", anyOf: ["migration", "version control", "sql injection", "parameteri", "injection"], min: 2 },
      { label: "Knows the limits: N+1 queries, abstraction leaks, raw SQL as an escape hatch", anyOf: ["n+1", "raw sql", "$queryraw", "escape hatch", "abstraction", "performance", "complex quer"] },
    ],
    modelAnswer:
      "An ORM maps database tables to typed models in code, so with Prisma I describe my schema once in schema.prisma and get a generated, type-safe client with autocomplete; a wrong field name fails at compile time. Migrations keep schema changes in version control, and the client parameterises queries, which protects against SQL injection. The trade-offs are that it can hide expensive queries such as N+1 patterns, so I still check what is generated, and for complex reporting I drop to raw SQL through the escape hatch.",
  },
  {
    id: "fs-04",
    difficulty: "INTERMEDIATE",
    topic: "Server Actions and forms",
    text: "What is a Server Action, and how does it differ from a Route Handler? When would you use each, and what must you remember about security?",
    rubric: [
      { label: "A Server Action is an async function marked 'use server' that runs on the server and can be called from forms and components", anyOf: ["use server", "async function", "form", "action=", "called from", "useactionstate"], min: 2 },
      { label: "A Route Handler is an HTTP endpoint in route.ts for external clients, webhooks or JSON APIs", anyOf: ["route.ts", "route handler", "endpoint", "webhook", "external", "get request", "json api"], min: 2 },
      { label: "Picks actions for your own UI mutations and handlers for public or non-form APIs", anyOf: ["mutation", "own ui", "your own", "third-party", "mobile app", "public api", "revalidate"] },
      { label: "Treats both as public endpoints: authenticate, authorise and validate input", anyOf: ["public endpoint", "authenticat", "authoris", "authoriz", "validate", "zod", "never trust"], min: 2 },
    ],
    modelAnswer:
      "A Server Action is an async function marked 'use server' that I can pass to a form's action or call from a component; Next handles the POST, works without JavaScript for forms, and lets me revalidate cached data after the mutation. A Route Handler is an HTTP endpoint defined in route.ts, which suits webhooks, third-party or mobile clients and JSON APIs. I use actions for mutations from my own UI and handlers when something outside my UI needs a URL. Both are public endpoints, so each must authenticate the user, authorise the action and validate input with something like Zod.",
  },
  {
    id: "fs-05",
    difficulty: "INTERMEDIATE",
    topic: "Caching and revalidation",
    text: "Explain static rendering, dynamic rendering and incremental static regeneration in Next.js. How do revalidatePath and revalidateTag fit in?",
    rubric: [
      { label: "Static rendering builds the page once at build time and serves it from a CDN", anyOf: ["build time", "at build", "static", "cdn", "generateStaticParams", "ssg"], min: 2 },
      { label: "Dynamic rendering runs per request, for example when it reads cookies or search params", anyOf: ["per request", "every request", "cookies", "headers", "searchparams", "ssr", "personali"], min: 2 },
      { label: "ISR serves a cached page and regenerates it in the background after a revalidate interval", anyOf: ["isr", "incremental", "revalidate", "stale-while-revalidate", "background", "regenerat"], min: 2 },
      { label: "On-demand revalidation with revalidatePath or revalidateTag after a mutation", anyOf: ["revalidatepath", "revalidatetag", "on-demand", "on demand", "after a mutation", "tag"] },
    ],
    modelAnswer:
      "A statically rendered page is built once at build time and served from a CDN, which is fastest; generateStaticParams pre-builds dynamic paths. A dynamically rendered page runs on every request, which happens when it reads cookies, headers or search params, so it can be personalised. Incremental static regeneration sits between them: the cached page is served, and after the revalidate interval Next regenerates it in the background. For on-demand freshness, a Server Action calls revalidatePath or revalidateTag after a mutation so the next visitor sees new data.",
  },
  {
    id: "fs-06",
    difficulty: "INTERMEDIATE",
    topic: "Route Handlers and auth",
    text: "How do you protect pages, Server Actions and API routes in a Next.js app that uses Auth.js? Why is hiding a button not enough?",
    rubric: [
      { label: "Explains the session: a signed cookie or JWT that is read on the server", anyOf: ["session", "cookie", "jwt", "signed", "auth()", "getserversession"], min: 2 },
      { label: "Checks the session inside every page, action and route handler, not only in one place", anyOf: ["every", "each", "inside the action", "inside the route", "at the data", "in the handler", "close to the data"], min: 1 },
      { label: "Knows that proxy or middleware checks are optimistic redirects, not the real security boundary", anyOf: ["proxy", "middleware", "optimistic", "redirect", "not enough", "first line"] },
      { label: "Authorises by role or ownership on the server and uses 401 versus 403", anyOf: ["role", "ownership", "owner", "authoris", "authoriz", "401", "403", "admin"], min: 2 },
    ],
    modelAnswer:
      "Auth.js stores the session in a signed cookie, and on the server I read it with auth(). I check it inside every page, Server Action and route handler, close to the data, because actions and handlers are public endpoints that anyone can call directly with curl, so hiding a button is only cosmetics. A proxy or middleware redirect for signed-out visitors is an optimistic first line, not the real security boundary. After authentication I authorise: check the user's role or that they own the record, and return 401 when not signed in and 403 when not allowed.",
  },
  {
    id: "fs-07",
    difficulty: "ADVANCED",
    topic: "Data access with an ORM",
    text: "A page loads a list of interviews and then runs a separate query for the feedback of each one. What is the problem and how would you fix it with Prisma?",
    rubric: [
      { label: "Names it: the N+1 query problem, one query for the list and N more for the rows", anyOf: ["n+1", "n plus one", "one query for the list", "extra query", "per row", "for each"], min: 1 },
      { label: "Explains the cost: latency and database load grow with the number of rows", anyOf: ["latency", "round trip", "round-trip", "load", "grows", "scales with", "slow"], min: 1 },
      { label: "Fixes it with a single query using include or select, or a batched in query", anyOf: ["include", "select", "join", "single query", "one query", "in clause", "batch"], min: 2 },
      { label: "Adds supporting practices: pagination, indexing the foreign key, selecting only needed columns, measuring with query logs", anyOf: ["paginat", "take", "skip", "cursor", "index", "foreign key", "query log", "log", "only the columns"], min: 2 },
    ],
    modelAnswer:
      "That is the N+1 query problem: one query fetches the list and then one more query runs per row, so latency and database load grow with the number of interviews. With Prisma I would fetch everything in a single query using include or select on the relation, or batch with an in filter, and select only the columns I need. I would paginate with take and skip or a cursor, make sure the foreign key is indexed, and turn on Prisma's query logging to confirm the number of queries went down.",
  },
  {
    id: "fs-08",
    difficulty: "ADVANCED",
    topic: "Server vs Client Components",
    text: "A dashboard has three independent widgets whose data loads at different speeds. How would you structure it in the App Router so it feels fast?",
    rubric: [
      { label: "Fetches in parallel and avoids request waterfalls", anyOf: ["parallel", "promise.all", "waterfall", "independent", "at the same time", "concurrently"], min: 1 },
      { label: "Wraps each widget in its own Suspense boundary with a skeleton so the page streams", anyOf: ["suspense", "stream", "skeleton", "fallback", "loading.tsx", "boundary"], min: 2 },
      { label: "Can use separate async Server Components or parallel route slots, one per widget", anyOf: ["async server component", "separate component", "parallel route", "@slot", "slot", "each widget"], min: 1 },
      { label: "Keeps interactivity in small Client Components and isolates failures with error boundaries or caching", anyOf: ["client component", "error boundary", "error.tsx", "react cache", "dedup", "cache", "small"], min: 2 },
    ],
    modelAnswer:
      "I would make each widget its own async Server Component, or a parallel route slot, so they fetch independently and in parallel rather than in a waterfall. Each one is wrapped in a Suspense boundary with a skeleton fallback, so the static shell streams immediately and each widget appears as its data arrives instead of the page waiting for the slowest query. Interactivity goes into small Client Components only where needed. I would add an error boundary per widget so one failure does not take down the dashboard, and use React cache to deduplicate shared queries.",
  },
];
