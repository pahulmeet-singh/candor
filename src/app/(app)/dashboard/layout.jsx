/**
 * Parallel routes. `children` is `page.jsx`; `stats`, `trend` and `upcoming`
 * are the folders `@stats`, `@trend` and `@upcoming`. Each slot is its own
 * route with its own data fetching and its own `loading.jsx`, so the four
 * regions load and stream in independently instead of the whole page waiting
 * for the slowest query.
 */
export default function DashboardLayout({ children, stats, trend, upcoming }) {
  return (
    <div className="grid gap-8">
      {children}
      {stats}
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        {trend}
        {upcoming}
      </div>
    </div>
  );
}
