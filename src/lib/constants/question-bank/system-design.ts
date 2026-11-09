import type { BankQuestion } from "./types";

export const SYSTEM_DESIGN_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "sd-01",
    difficulty: "BEGINNER",
    topic: "Requirements and estimation",
    text: "You are asked to design a URL shortener. What questions do you ask before drawing anything, and what rough numbers do you estimate?",
    rubric: [
      { label: "Clarifies functional requirements: shorten, redirect, custom alias, expiry, analytics", anyOf: ["shorten", "redirect", "custom alias", "expiry", "expire", "analytics", "functional"], min: 2 },
      { label: "Clarifies non-functional needs: availability, latency, scale, read-heavy traffic", anyOf: ["availability", "latency", "non-functional", "read-heavy", "reads", "scale", "durab"], min: 2 },
      { label: "Does a back-of-the-envelope estimate: requests per second and storage over years", anyOf: ["per second", "qps", "rps", "storage", "estimate", "back-of-the-envelope", "per day", "million"], min: 2 },
      { label: "States assumptions and keeps the scope small", anyOf: ["assum", "scope", "out of scope", "mvp", "start simple"] },
    ],
    modelAnswer:
      "I would first pin down the functional scope: create a short link, redirect to the original, maybe custom aliases, expiry and click analytics, and say what is out of scope. Then the non-functional needs: redirects must be fast and highly available, and traffic is read-heavy, perhaps a hundred reads per write. Then a back-of-the-envelope estimate: say 100 million new links a month is roughly 40 writes per second and 4,000 reads per second, and a few hundred bytes per record gives terabytes of storage over several years. I would state these assumptions out loud and start with the simplest design that meets them.",
  },
  {
    id: "sd-02",
    difficulty: "BEGINNER",
    topic: "Load balancing and scaling",
    text: "What is the difference between vertical and horizontal scaling, and what does a load balancer do?",
    rubric: [
      { label: "Vertical scaling means a bigger machine, with a hard ceiling and a single point of failure", anyOf: ["vertical", "bigger machine", "more cpu", "scale up", "ceiling", "single point of failure"], min: 2 },
      { label: "Horizontal scaling means more machines, which needs stateless services", anyOf: ["horizontal", "more machines", "more servers", "scale out", "stateless"], min: 2 },
      { label: "A load balancer spreads requests and runs health checks", anyOf: ["distribut", "spread", "health check", "round robin", "round-robin", "least connections", "routes traffic"], min: 2 },
      { label: "Keeps session state out of the app servers (shared store, sticky sessions)", anyOf: ["sticky", "shared store", "redis", "session state", "externalis", "externaliz"] },
    ],
    modelAnswer:
      "Vertical scaling gives one machine more CPU or memory. It is simple, but it has a hard ceiling and leaves a single point of failure. Horizontal scaling adds more machines behind a load balancer, which needs the services to be stateless so any server can handle any request. The load balancer distributes traffic using round robin or least connections, runs health checks and stops sending requests to a failed node. Session state moves to a shared store such as Redis, or the balancer uses sticky sessions as a fallback.",
  },
  {
    id: "sd-03",
    difficulty: "BEGINNER",
    topic: "Databases and sharding",
    text: "When would you choose a relational database over a NoSQL store, and when the reverse?",
    rubric: [
      { label: "Relational fits structured data, joins and ACID transactions", anyOf: ["relational", "sql", "join", "acid", "transaction", "schema", "structured"], min: 2 },
      { label: "NoSQL fits flexible schemas, huge scale or simple key-based access", anyOf: ["nosql", "flexible schema", "key-value", "document", "wide-column", "horizontal", "throughput"], min: 2 },
      { label: "Lets the access patterns drive the choice", anyOf: ["access pattern", "query pattern", "how the data is read", "how you query", "use case"] },
      { label: "Knows the consistency trade-off or that you can mix both", anyOf: ["consisten", "eventual", "polyglot", "both", "mix"] },
    ],
    modelAnswer:
      "I pick a relational database when the data is structured, has relationships I need to join, and needs ACID transactions, for example orders and payments. I pick a NoSQL store, a key-value or document database, when the schema is flexible, the access pattern is simple lookups by key, or write throughput and horizontal scale matter more than joins. The access patterns should drive the choice, not fashion. NoSQL often trades strong consistency for availability, and many systems sensibly use both.",
  },
  {
    id: "sd-04",
    difficulty: "INTERMEDIATE",
    topic: "Caching and CDNs",
    text: "Where can you add caching in a read-heavy web system, and how do you keep the cache correct?",
    rubric: [
      { label: "Names the layers: browser, CDN, application cache such as Redis, database", anyOf: ["browser", "cdn", "redis", "memcached", "application cache", "edge"], min: 2 },
      { label: "Names a strategy: cache-aside, write-through or write-behind", anyOf: ["cache-aside", "cache aside", "write-through", "write through", "write-behind", "write back"] },
      { label: "Handles invalidation: TTL, delete on write, versioned keys", anyOf: ["ttl", "invalidat", "expire", "delete the key", "versioned", "purge"] },
      { label: "Knows the pitfalls: stampede, stale data, hot keys, eviction policy", anyOf: ["stampede", "thundering", "stale", "hot key", "eviction", "lru"] },
    ],
    modelAnswer:
      "I would cache at several layers: the browser and a CDN for static and public content, an application cache such as Redis for computed results, and the database's own buffer cache. A common pattern is cache-aside: read from the cache, on a miss read the database and fill the cache, and delete or update the key when the data is written. I choose a TTL as a safety net and use versioned keys for bulk changes. The pitfalls are stale data, a cache stampede when a hot key expires at once, and choosing an eviction policy such as LRU.",
  },
  {
    id: "sd-05",
    difficulty: "INTERMEDIATE",
    topic: "Queues and async work",
    text: "Why would you put a message queue between two services? Give an example and the problems it introduces.",
    rubric: [
      { label: "Benefits: decoupling, absorbing traffic spikes, retries", anyOf: ["decoupl", "buffer", "spike", "absorb", "retry", "retries", "asynchronous", "async"], min: 2 },
      { label: "Gives a concrete example such as email, image processing or notifications", anyOf: ["email", "image", "video", "notification", "order", "report", "thumbnail"] },
      { label: "Knows delivery is at-least-once, so consumers must be idempotent", anyOf: ["at-least-once", "at least once", "idempot", "duplicate", "exactly once"] },
      { label: "Names operational concerns: ordering, dead-letter queue, backpressure, queue depth", anyOf: ["dead-letter", "dead letter", "ordering", "backpressure", "queue depth", "poison", "monitor"] },
    ],
    modelAnswer:
      "A queue decouples the producer from the consumer: the web request enqueues a job such as sending an email or resizing an image and returns immediately, and workers process it at their own pace. It absorbs traffic spikes, lets failed jobs be retried and lets each side scale independently. The costs are that delivery is usually at-least-once, so consumers must be idempotent, and ordering is not guaranteed. I would add a dead-letter queue for poison messages, watch the queue depth and apply backpressure when it grows.",
  },
  {
    id: "sd-06",
    difficulty: "INTERMEDIATE",
    topic: "Databases and sharding",
    text: "Your single database has become the bottleneck. What are your options for scaling it, in the order you would try them?",
    rubric: [
      { label: "Starts cheap: query tuning, indexes and caching before adding machines", anyOf: ["index", "query tuning", "optimi", "explain", "cache", "slow quer"], min: 2 },
      { label: "Adds read replicas and knows about replication lag", anyOf: ["read replica", "replica", "replication lag", "leader", "follower", "primary"], min: 2 },
      { label: "Considers partitioning or sharding and the choice of shard key", anyOf: ["shard", "partition", "shard key", "hash", "range"], min: 2 },
      { label: "Names the costs of sharding: hot spots, cross-shard queries, resharding", anyOf: ["hot spot", "hotspot", "cross-shard", "resharding", "rebalanc", "complexity", "joins"] },
    ],
    modelAnswer:
      "First the cheap wins: find slow queries with EXPLAIN, add missing indexes and put a cache in front of hot reads. Then add read replicas so reads are spread across followers, accepting some replication lag. If writes are still the limit, I would partition the data, for example by user id, using a shard key that spreads load evenly. Sharding brings real costs: hot shards, cross-shard joins and transactions, and painful resharding, so it comes last.",
  },
  {
    id: "sd-07",
    difficulty: "ADVANCED",
    topic: "Reliability and trade-offs",
    text: "Explain the CAP theorem and how it would influence your database choice for a shopping cart versus a bank ledger.",
    rubric: [
      { label: "States consistency, availability and partition tolerance", anyOf: ["consistency", "availability", "partition tolerance", "partition"], min: 3 },
      { label: "Explains that partitions happen, so the real choice is consistency versus availability during one", anyOf: ["during a partition", "network partition", "choose between", "trade-off", "cannot have all three", "must choose"] },
      { label: "Shopping cart leans towards availability with eventual consistency and merging", anyOf: ["cart", "available", "eventual", "merge", "dynamo", "cassandra"], min: 2 },
      { label: "Ledger leans towards strong consistency and transactions", anyOf: ["ledger", "bank", "strong consistency", "serializable", "transaction", "spanner", "postgres"], min: 2 },
    ],
    modelAnswer:
      "CAP says a distributed data store cannot guarantee consistency, availability and partition tolerance all at once. Network partitions will happen, so the real choice is what to give up during one: consistency or availability. A shopping cart favours availability: a customer should always be able to add an item, and diverging copies can be merged later, so an eventually consistent store in the style of Dynamo or Cassandra fits. A bank ledger favours strong consistency: it is better to reject a request than to show or lose a wrong balance, so I would use a transactional database with serializable guarantees. Tunable quorums let one system sit between the two.",
  },
  {
    id: "sd-08",
    difficulty: "ADVANCED",
    topic: "Reliability and trade-offs",
    text: "Design a rate limiter for a public API. Which algorithm would you use, where does it run, and how does it work across many servers?",
    rubric: [
      { label: "Compares algorithms: token bucket, leaky bucket, fixed window, sliding window", anyOf: ["token bucket", "leaky bucket", "fixed window", "sliding window"], min: 2 },
      { label: "Chooses a key to limit by: user, API key or IP", anyOf: ["api key", "per user", "per ip", "ip address", "client id", "user id"] },
      { label: "Shares counters across servers with atomic operations in a store such as Redis", anyOf: ["redis", "atomic", "incr", "lua", "shared", "distributed"], min: 2 },
      { label: "Responds with 429 and Retry-After, and decides how to fail when the store is down", anyOf: ["429", "retry-after", "fail open", "fail-open", "fail closed", "fail-closed", "headers"], min: 2 },
    ],
    modelAnswer:
      "I would use a token bucket: each client's bucket refills at a steady rate and each request spends a token, which allows short bursts while enforcing an average rate. A fixed window is simpler but lets double the limit through at a window boundary, and a sliding window fixes that at a higher memory cost. The limiter runs at the gateway or edge, keyed by API key, user id or IP. Counters live in Redis and are updated atomically with INCR and expiry or a Lua script so all servers share one view. Over the limit, I return 429 with a Retry-After header, and I would decide deliberately whether to fail open or fail closed when Redis is unreachable.",
  },
];
