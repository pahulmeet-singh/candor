import type { BankQuestion } from "./types";

export const BACKEND_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "be-01",
    difficulty: "BEGINNER",
    topic: "REST design and status codes",
    text: "What makes an API RESTful? Describe the HTTP methods and status codes you would use for a todo resource.",
    rubric: [
      { label: "Models things as resources with URLs, and requests as stateless", anyOf: ["resource", "noun", "stateless", "/todos"] },
      { label: "Maps methods to actions: GET, POST, PUT or PATCH, DELETE", anyOf: ["get", "post", "put", "patch", "delete"], min: 3 },
      { label: "Uses status codes properly: 200, 201, 204, 400, 404", anyOf: ["201", "204", "404", "400", "200", "422"], min: 3 },
      { label: "Understands idempotency and safe methods", anyOf: ["idempot", "safe method", "cacheable"] },
    ],
    modelAnswer:
      "REST models things as resources with URLs (/todos, /todos/42) and uses HTTP verbs for the action, with each request stateless. GET reads, POST creates and returns 201 with the new resource, PUT replaces and PATCH partially updates, and DELETE removes and returns 204. Bad input is 400 or 422, a missing todo is 404, and an unauthenticated caller gets 401. GET, PUT and DELETE are idempotent, so retrying them is safe, which is not true of POST.",
  },
  {
    id: "be-02",
    difficulty: "BEGINNER",
    topic: "Authentication and sessions",
    text: "Explain the difference between authentication and authorisation, with an example.",
    rubric: [
      { label: "Authentication is who you are; authorisation is what you are allowed to do", anyOf: ["who you are", "identity", "verify", "what you are allowed", "permission", "allowed to"] },
      { label: "Gives a concrete example such as login and an admin-only action", anyOf: ["admin", "role", "login", "password", "token"] },
      { label: "Knows 401 versus 403", anyOf: ["401", "403", "unauthorized", "forbidden"] },
    ],
    modelAnswer:
      "Authentication proves who you are, for example by logging in with a password or Google. Authorisation decides what that identity may do, for example only admins can change roles. Authentication comes first. In HTTP a missing or invalid identity is 401, while a known user without permission gets 403. Authorisation has to be checked on the server for every request, not just hidden in the UI.",
  },
  {
    id: "be-03",
    difficulty: "BEGINNER",
    topic: "SQL and indexing",
    text: "What is an index in a relational database, and what is the cost of adding one?",
    rubric: [
      { label: "An index is a sorted structure (often a B-tree) that avoids scanning the whole table", anyOf: ["b-tree", "btree", "sorted", "full table scan", "seq scan", "lookup", "avoid scanning"] },
      { label: "Names the costs: slower writes and extra storage", anyOf: ["slower write", "writes", "insert", "storage", "disk space", "maintain"] },
      { label: "Says what to index: WHERE, JOIN and ORDER BY columns, selectivity, composite order", anyOf: ["where", "join", "order by", "selectiv", "composite", "foreign key"] },
    ],
    modelAnswer:
      "An index is an extra sorted structure, usually a B-tree, that lets the database jump to matching rows instead of scanning the whole table. It speeds up WHERE, JOIN and ORDER BY on the indexed columns. The cost is paid on writes: every insert, update or delete must also maintain each index, and indexes take disk space. So I index columns that are selective and queried often, such as foreign keys, and check the plan with EXPLAIN.",
  },
  {
    id: "be-04",
    difficulty: "INTERMEDIATE",
    topic: "Authentication and sessions",
    text: "Compare session-based and JWT authentication for a web app. Which would you choose and why?",
    rubric: [
      { label: "Sessions: the server stores state, the cookie holds an id, revocation is easy", anyOf: ["session id", "server-side", "server stores", "revoke", "revocation", "cookie"] },
      { label: "JWT: signed, stateless, self-contained claims, hard to revoke before expiry", anyOf: ["signed", "stateless", "claims", "payload", "expire", "hard to revoke"] },
      { label: "Cookie hardening: HttpOnly, Secure, SameSite, CSRF", anyOf: ["httponly", "secure", "samesite", "csrf"] },
      { label: "Makes a decision with reasons: trade-offs, short-lived tokens, scale", anyOf: ["depends", "trade-off", "refresh token", "short-lived", "scale", "microservice"] },
    ],
    modelAnswer:
      "With sessions the server stores the session and the browser holds only an opaque id in a cookie, so logout and revocation are instant but the store must be shared across instances. A JWT is a signed, self-contained token that any server can verify statelessly, which scales easily but is hard to revoke before it expires, so I keep it short-lived with refresh tokens. Either way I use HttpOnly, Secure, SameSite cookies and CSRF protection. For a single Next.js app I would pick a JWT in a cookie and re-check the database for sensitive actions.",
  },
  {
    id: "be-05",
    difficulty: "INTERMEDIATE",
    topic: "Caching",
    text: "What are the trade-offs of caching API responses, and how do you invalidate a cache?",
    rubric: [
      { label: "States the benefit: lower latency and less load on the database", anyOf: ["latency", "load", "faster", "reduce", "database"] },
      { label: "Names the layers: browser, CDN, in-process, Redis", anyOf: ["cdn", "redis", "browser cache", "in-memory", "http cache", "cache-control"] },
      { label: "Handles staleness: TTL, event-based invalidation, revalidation", anyOf: ["ttl", "stale", "invalidat", "expire", "revalidat", "purge"] },
      { label: "Knows the pitfalls: stampede, consistency, cold start", anyOf: ["stampede", "thundering", "consistency", "cold start", "hit rate"] },
    ],
    modelAnswer:
      "Caching stores computed results closer to the consumer to cut latency and database load. It can live in the browser, a CDN, the app process or Redis, controlled with Cache-Control headers or explicit keys. The price is staleness: you choose a TTL, invalidate on writes, or revalidate in the background with stale-while-revalidate. The hard parts are invalidating correctly, cache stampedes when a hot key expires, and keeping user-specific data out of shared caches.",
  },
  {
    id: "be-06",
    difficulty: "INTERMEDIATE",
    topic: "Transactions and consistency",
    text: "Explain database transactions and the ACID properties. When would you use a higher isolation level?",
    rubric: [
      { label: "Names the ACID properties", anyOf: ["atomic", "consisten", "isolation", "durab"], min: 3 },
      { label: "Gives an all-or-nothing example such as a money transfer", anyOf: ["transfer", "all or nothing", "rollback", "commit", "bank"] },
      { label: "Knows the anomalies weak isolation allows", anyOf: ["dirty read", "phantom", "non-repeatable", "write skew", "race condition", "lost update"] },
      { label: "Uses higher isolation where needed and accepts retries", anyOf: ["serializable", "retry", "lock", "contention", "performance", "double book", "oversell"] },
    ],
    modelAnswer:
      "A transaction groups statements so they succeed or fail together. ACID stands for atomicity (all or nothing, with rollback on failure), consistency (constraints hold before and after), isolation (concurrent transactions do not see each other's half-finished work) and durability (committed data survives a crash). Weaker isolation allows anomalies such as non-repeatable reads, phantoms and write skew. For something like seat booking I would use Serializable, accept that some transactions abort, and retry them.",
  },
  {
    id: "be-07",
    difficulty: "ADVANCED",
    topic: "Transactions and consistency",
    text: "Your endpoint that charges a card is called twice because the client retried. How do you make it safe?",
    rubric: [
      { label: "Introduces an idempotency key", anyOf: ["idempotency key", "idempotent", "unique key", "request id"] },
      { label: "Stores the outcome and returns the same response for a repeat", anyOf: ["store", "return the same", "previous response", "dedupe", "deduplicate", "unique constraint"] },
      { label: "Handles concurrent duplicates atomically: unique constraint, transaction, lock", anyOf: ["unique constraint", "transaction", "lock", "race", "atomic"] },
      { label: "Accepts that networks retry: backoff, timeouts, at-least-once delivery", anyOf: ["retry", "timeout", "at-least-once", "exactly once", "backoff", "webhook"] },
    ],
    modelAnswer:
      "I would make the operation idempotent. The client sends an idempotency key per logical attempt; the server stores the key with the outcome behind a unique constraint, inside the same transaction as the charge. A retry with the same key returns the stored response instead of charging again, and a concurrent duplicate is blocked by the unique constraint. Networks give at-least-once delivery, so retries with backoff are expected, and I would also use the payment provider's own idempotency support.",
  },
  {
    id: "be-08",
    difficulty: "ADVANCED",
    topic: "Error handling and observability",
    text: "How would you add observability to a production API so you can debug a slow or failing request?",
    rubric: [
      { label: "Names logs, metrics and traces", anyOf: ["logs", "metrics", "traces", "tracing"], min: 2 },
      { label: "Uses a correlation id and structured logs", anyOf: ["request id", "correlation", "structured", "json log", "trace id"] },
      { label: "Measures the right things: latency percentiles, error rate, saturation", anyOf: ["p95", "p99", "percentile", "error rate", "slo", "saturation", "throughput"] },
      { label: "Adds alerting and log hygiene: alerts, error tracking, redacting secrets", anyOf: ["alert", "dashboard", "sentry", "redact", "pii", "sampling"] },
    ],
    modelAnswer:
      "I would combine structured logs, metrics and distributed traces. Every request gets a correlation id that appears in each log line and downstream call, so one failing request can be followed end to end. Metrics track latency percentiles (p95, p99), error rate and saturation per route, with alerts tied to SLOs rather than raw CPU, and traces show which dependency is slow. I would also report unhandled errors to a tool like Sentry and redact secrets and personal data from logs.",
  },
];
