import type { BankQuestion } from "./types";

export const FRONTEND_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "fe-01",
    difficulty: "BEGINNER",
    topic: "Semantic HTML and accessibility",
    text: "What is semantic HTML, and why does it matter for accessibility and SEO?",
    rubric: [
      { label: "Defines semantic HTML as choosing elements for meaning (header, nav, main, article, button)", anyOf: ["meaning", "header", "nav", "article", "button", "landmark", "semantic element"] },
      { label: "Connects it to assistive technology: screen readers, landmarks, keyboard focus", anyOf: ["screen reader", "assistive", "accessib", "keyboard", "landmark", "aria"] },
      { label: "Mentions search engines understanding the page structure", anyOf: ["seo", "search engine", "crawler", "index", "ranking"] },
      { label: "Contrasts it with generic div and span containers", anyOf: ["div", "span", "generic", "non-semantic", "div soup"] },
    ],
    modelAnswer:
      "Semantic HTML means choosing elements for what the content is, not how it looks: header, nav, main, article and button instead of a pile of divs. Browsers and screen readers use that meaning to build landmarks, support keyboard focus and announce controls correctly, and search engines use the structure to understand the page. A clickable div needs ARIA roles and key handlers to imitate a button, while a real button gives focus, Enter and Space for free.",
  },
  {
    id: "fe-02",
    difficulty: "BEGINNER",
    topic: "CSS layout and specificity",
    text: "Explain the CSS box model, and what changes when you set box-sizing to border-box.",
    rubric: [
      { label: "Names the layers: content, padding, border, margin", anyOf: ["content", "padding", "border", "margin"], min: 3 },
      { label: "Explains that with content-box the width applies to the content only, so padding and border add to the total", anyOf: ["content-box", "only the content", "add to", "on top of the width", "total width"] },
      { label: "Explains that border-box includes padding and border inside the declared width", anyOf: ["border-box", "includes padding", "include padding", "includes the padding", "width includes"] },
      { label: "Says why it matters: predictable sizing and layouts", anyOf: ["predictable", "easier", "layout", "reset", "sizing", "overflow"] },
    ],
    modelAnswer:
      "Every element is a box made of content, padding, border and margin, from the inside out. With the default content-box, width and height set only the content area, so padding and border are added on top and the real width grows. With border-box, the declared width includes padding and border, so a 300px box stays 300px. That is why most projects reset every element to border-box: sizing becomes predictable and layouts stop overflowing.",
  },
  {
    id: "fe-03",
    difficulty: "BEGINNER",
    topic: "JavaScript fundamentals",
    text: "What is the difference between var, let and const in JavaScript?",
    rubric: [
      { label: "Scope: var is function-scoped, let and const are block-scoped", anyOf: ["function-scoped", "function scope", "block scope", "block-scoped"] },
      { label: "Hoisting and the temporal dead zone", anyOf: ["hoist", "temporal dead zone", "tdz", "undefined before"] },
      { label: "const blocks reassignment, not mutation of the value", anyOf: ["reassign", "mutat", "object can still", "cannot be reassigned", "immutable"] },
      { label: "A practical rule: default to const, use let when it must change", anyOf: ["prefer const", "default to const", "use const", "by default"] },
    ],
    modelAnswer:
      "var is function-scoped and hoisted with the value undefined. let and const are block-scoped and hoisted too, but sit in the temporal dead zone until their declaration runs, so using them early throws. const forbids reassigning the binding, not mutating the object it points to. I default to const, use let when a value must change, and avoid var, because function scope and hoisting cause surprising bugs, especially with closures in loops.",
  },
  {
    id: "fe-04",
    difficulty: "INTERMEDIATE",
    topic: "Closures and the event loop",
    text: "Explain how closures work in JavaScript and give a practical use for one.",
    rubric: [
      { label: "Defines a closure: a function keeps access to its lexical scope after the outer function returns", anyOf: ["lexical scope", "lexical environment", "remembers", "outer scope", "enclosing", "outer function"] },
      { label: "Gives a practical use: private state, counters, callbacks, debounce, memoisation", anyOf: ["counter", "private", "factory", "callback", "debounce", "memo", "once"] },
      { label: "Knows a pitfall: loop variables, stale values or retained memory", anyOf: ["loop", "var in a", "memory leak", "stale", "garbage"] },
    ],
    modelAnswer:
      "A closure is a function bundled with the lexical environment it was created in, so it keeps access to the outer function's variables even after that function has returned. Typical uses are private state such as a counter factory, event handlers and callbacks, and utilities like debounce or memoize. The classic pitfall is a var declared in a loop being shared by every callback; let creates a fresh binding per iteration. Long-lived closures can also keep large objects alive.",
  },
  {
    id: "fe-05",
    difficulty: "INTERMEDIATE",
    topic: "Closures and the event loop",
    text: "Walk me through the JavaScript event loop. What runs first: a promise callback or a setTimeout of 0 milliseconds?",
    rubric: [
      { label: "Describes the call stack and the task (macrotask) queue", anyOf: ["call stack", "task queue", "macrotask", "callback queue"] },
      { label: "Explains microtasks: promise reactions run after the current script, before the next task", anyOf: ["microtask", "promise", "then"] },
      { label: "Concludes the promise callback runs before the timer", anyOf: ["promise first", "before settimeout", "before the timeout", "before the timer", "before the next task", "runs first", "drained"] },
      { label: "Notes JavaScript is single-threaded and a long task blocks everything", anyOf: ["single-thread", "single thread", "non-blocking", "block the", "web api", "freezes"] },
    ],
    modelAnswer:
      "JavaScript runs on one thread with a call stack. Async work is handled by the host (Web APIs), which queues callbacks. When the stack empties, the loop first drains the microtask queue (promise reactions, queueMicrotask) and then takes one macrotask such as a timer callback. So a resolved promise's then handler runs before setTimeout with 0, even though both are asynchronous. A long synchronous task blocks both and freezes the page.",
  },
  {
    id: "fe-06",
    difficulty: "INTERMEDIATE",
    topic: "React state and rendering",
    text: "How does React decide when to re-render a component, and how would you prevent unnecessary renders?",
    rubric: [
      { label: "Lists the triggers: state change, parent re-render, props, context", anyOf: ["state", "parent", "props", "context"], min: 2 },
      { label: "Mentions reconciliation: React diffs the new tree against the old one", anyOf: ["reconcil", "virtual dom", "diff"] },
      { label: "Offers tools: moving state down, memo, useMemo, useCallback, splitting components", anyOf: ["memo", "usememo", "usecallback", "colocat", "lift", "split the component", "move state"] },
      { label: "Says to measure first with the Profiler", anyOf: ["profil", "measure", "premature"] },
    ],
    modelAnswer:
      "A component re-renders when its state changes, when its parent re-renders, or when a context it reads changes. React then reconciles the new element tree against the previous one and updates only the DOM that differs, so a render is not the same as a DOM update. To cut wasted work I first move state down so fewer components depend on it, then use React.memo with stable props via useMemo and useCallback where it helps. I measure with the Profiler before optimising.",
  },
  {
    id: "fe-07",
    difficulty: "ADVANCED",
    topic: "Browser performance",
    text: "A page scores badly on Largest Contentful Paint and on interaction latency. How would you diagnose it and what would you change?",
    rubric: [
      { label: "Measures first: Lighthouse, DevTools performance panel, field data (Web Vitals)", anyOf: ["lighthouse", "devtools", "web vitals", "performance panel", "rum", "field data", "profil"] },
      { label: "Has concrete LCP fixes: hero image, preload, render-blocking resources, server response, CDN", anyOf: ["image", "preload", "critical", "render-blocking", "cdn", "server response", "ttfb", "font"] },
      { label: "Addresses the main thread: long tasks, code splitting, deferring, workers", anyOf: ["main thread", "long task", "code split", "defer", "web worker", "debounce", "hydration", "bundle"] },
      { label: "Verifies and guards against regression: re-measure, budgets, monitoring", anyOf: ["budget", "regression", "ci", "monitor", "re-measure", "verify"] },
    ],
    modelAnswer:
      "I would measure before changing anything: lab data from Lighthouse and the DevTools performance panel, plus field data (Core Web Vitals, RUM) to see real users. For LCP I find the slow part: server response time, render-blocking CSS and JS, or the hero image, fixed with a CDN, preload, correctly sized modern image formats and font-display. For interaction latency I look for long main-thread tasks, then split bundles, defer non-critical scripts and move heavy work to a worker. Then I re-measure and add a performance budget in CI.",
  },
  {
    id: "fe-08",
    difficulty: "ADVANCED",
    topic: "Web security basics",
    text: "What is cross-site scripting (XSS), and how do you defend against it in a React or Next.js application?",
    rubric: [
      { label: "Defines XSS: untrusted input runs as script in another user's browser", anyOf: ["inject", "malicious script", "untrusted", "script runs", "attacker"] },
      { label: "Knows the types: stored, reflected, DOM-based", anyOf: ["stored", "reflected", "dom-based", "dom based"] },
      { label: "Names the defences in React: default escaping, avoiding dangerouslySetInnerHTML, sanitising", anyOf: ["escape", "dangerouslysetinnerhtml", "sanitiz", "sanitis", "dompurify", "encode"] },
      { label: "Adds defence in depth: CSP, HttpOnly cookies, server-side validation", anyOf: ["csp", "content security policy", "httponly", "http-only", "validat"] },
    ],
    modelAnswer:
      "Cross-site scripting is when an attacker gets untrusted input rendered as executable script in another user's browser, to steal sessions or act as them. It can be stored, reflected or DOM-based. React escapes values in JSX by default, so the main risks are dangerouslySetInnerHTML, unsanitised URLs such as javascript: links, and third-party scripts. I sanitise any HTML I must render with DOMPurify, validate input on the server, set a Content Security Policy, and keep session cookies HttpOnly so a script cannot read them.",
  },
];
