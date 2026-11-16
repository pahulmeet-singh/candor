export const CATEGORY_KEYS = ["FRONTEND", "BACKEND", "DSA", "SYSTEM_DESIGN", "BEHAVIOURAL", "FULLSTACK_NEXT"];

export const CATEGORIES = [
  {
    key: "FRONTEND",
    slug: "frontend",
    label: "Frontend",
    short: "HTML, CSS, JavaScript, React and how the browser actually works.",
    description:
      "Questions on the browser platform and the component model: the box model and layout, specificity, closures and the event loop, how React decides what to re-render, and what makes a page feel fast and stay accessible.",
    topics: [
      "Semantic HTML and accessibility",
      "CSS layout and specificity",
      "Closures and the event loop",
      "React state and rendering",
      "Browser performance",
      "Web security basics",
    ],
    icon: "Monitor",
  },
  {
    key: "BACKEND",
    slug: "backend",
    label: "Backend & APIs",
    short: "REST design, auth, SQL, caching and keeping data consistent.",
    description:
      "Questions on building the server side: designing HTTP APIs, authenticating users safely, writing and indexing SQL, caching, and reasoning about transactions, retries and failure.",
    topics: [
      "REST design and status codes",
      "Authentication and sessions",
      "SQL and indexing",
      "Caching",
      "Transactions and consistency",
      "Error handling and observability",
    ],
    icon: "Server",
  },
  {
    key: "DSA",
    slug: "dsa",
    label: "Data structures & algorithms",
    short: "Arrays, hash maps, trees, graphs, recursion and complexity.",
    description:
      "Questions you would meet in a coding round, answered out loud: choose a data structure, explain the approach, state the time and space cost, and call out edge cases.",
    topics: [
      "Arrays and strings",
      "Hash maps",
      "Trees and graphs",
      "Sorting and searching",
      "Recursion and dynamic programming",
      "Complexity analysis",
    ],
    icon: "Braces",
  },
  {
    key: "SYSTEM_DESIGN",
    slug: "system-design",
    label: "System design",
    short: "Scaling, storage, caching, queues and trade-offs under load.",
    description:
      "Open-ended design questions: clarify requirements, estimate load, sketch components, then defend the trade-offs on storage, caching, consistency and failure.",
    topics: [
      "Requirements and estimation",
      "Load balancing and scaling",
      "Databases and sharding",
      "Caching and CDNs",
      "Queues and async work",
      "Reliability and trade-offs",
    ],
    icon: "Network",
  },
  {
    key: "BEHAVIOURAL",
    slug: "behavioural",
    label: "Behavioural & HR",
    short: "Teamwork, conflict, failure, ownership and why you.",
    description:
      "The questions that decide close calls: tell me about yourself, a disagreement, a failure, a time you led. Judged on whether your story has a situation, an action, a result and a lesson.",
    topics: [
      "Tell me about yourself",
      "Teamwork and conflict",
      "Failure and feedback",
      "Ownership and leadership",
      "Motivation and fit",
      "Handling ambiguity",
    ],
    icon: "MessagesSquare",
  },
  {
    key: "FULLSTACK_NEXT",
    slug: "fullstack-nextjs",
    label: "Full-stack Next.js",
    short: "App Router, Server Components, Server Actions and caching.",
    description:
      "Questions on modern Next.js: when to use a Server or Client Component, how Server Actions and Route Handlers differ, how caching and revalidation work, and how to structure data access with an ORM.",
    topics: [
      "App Router and layouts",
      "Server vs Client Components",
      "Server Actions and forms",
      "Caching and revalidation",
      "Route Handlers and auth",
      "Data access with an ORM",
    ],
    icon: "Layers",
  },
];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function isCategoryKey(value) {
  return typeof value === "string" && BY_KEY.has(value);
}

export function getCategory(key) {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`Unknown category: ${key}`);
  return found;
}

export function getCategoryBySlug(slug) {
  return BY_SLUG.get(slug);
}

export function categoryLabel(key) {
  return getCategory(key).label;
}
