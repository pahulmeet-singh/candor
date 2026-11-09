/**
 * What the `@modal` slot shows when no intercepted route is active (that is,
 * almost always). Next.js requires every parallel-route slot to have a
 * `default.tsx`, otherwise a hard refresh on an unmatched URL returns a 404.
 */
export default function ModalDefault() {
  return null;
}
