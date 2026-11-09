"use client";

import { useEffect, useId, useRef, useState } from "react";
import { categoryLabel } from "@/lib/constants/categories";
import { formatDay } from "@/lib/format";
import type { TrendPointDTO } from "@/lib/types";

export interface TrendChartProps {
  points: TrendPointDTO[];
}

/** Space reserved before the first measurement; close to the finished chart so the page barely shifts. */
const PLACEHOLDER_HEIGHT = 200;
const PAD = { top: 14, right: 12, bottom: 30, left: 34 };
/** Keeps the first and last dot off the axis and the right edge. */
const INSET = 10;
const GRID = [0, 25, 50, 75, 100] as const;
/** Smallest gap between two labels on the date axis. */
const MIN_LABEL_GAP = 72;

function heightFor(width: number): number {
  return Math.min(260, Math.max(190, Math.round(width * 0.42)));
}

/**
 * Score over time, newest on the right.
 *
 * It is a Client Component for two reasons: hovering, tapping or focusing a
 * point shows its details, and the chart is drawn at the width the card really
 * has. The second matters on phones. An SVG with a fixed `viewBox` is scaled
 * down as a whole, so 11px labels become 5px labels and the dots become too
 * small to tap. Measuring the container with a `ResizeObserver` and drawing in
 * real pixels keeps text and touch targets the same size at every width. (The
 * SVG's `max-w-full` lets its card shrink with the window; the next measurement
 * then redraws it at the new width.)
 *
 * The page loads it lazily (`trend-chart-lazy.tsx`, `ssr: false`) so the chart
 * code stays out of the first bundle. Points are evenly spaced instead of
 * placed by date: sessions are the unit the reader cares about, not the gaps
 * between them.
 */
export function TrendChart({ points }: TrendChartProps) {
  const gradientId = useId();
  const containerRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    // The first callback arrives before the first paint; later ones follow window or sidebar resizes.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = points.length;
  const height = width === null ? PLACEHOLDER_HEIGHT : heightFor(width);
  const innerW = (width ?? 0) - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const x = (index: number) =>
    count === 1 ? PAD.left + innerW / 2 : PAD.left + INSET + (index * (innerW - 2 * INSET)) / (count - 1);
  const y = (score: number) => PAD.top + innerH * (1 - score / 100);

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.score)}`).join(" ");
  const area = count > 1 ? `${line} L${x(count - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";

  // Label the newest point and every `step`-th one before it, so labels never sit side by side.
  const maxLabels = Math.max(2, Math.floor(innerW / MIN_LABEL_GAP));
  const step = Math.max(1, Math.ceil(count / maxLabels));

  const current = active === null || width === null ? null : (points[active] ?? null);
  // The tooltip is about 190px wide; keep it inside the card at both ends.
  const tooltipLeft = width === null || active === null ? 0 : Math.min(Math.max(x(active), 100), width - 100);
  // A point near the top has no room above it, so its tooltip opens downwards instead.
  const tooltipBelow = current !== null && y(current.score) < 72;

  return (
    <figure ref={containerRef} className="relative">
      {width === null ? (
        <div style={{ height: PLACEHOLDER_HEIGHT }} aria-hidden="true" />
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full" role="group" aria-label="Score history">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Tapping empty space dismisses a tooltip that a touch left open. */}
          <rect width={width} height={height} fill="transparent" onPointerDown={() => setActive(null)} />

          {GRID.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke={value === 50 || value === 75 ? "var(--line-strong)" : "var(--line)"}
                strokeDasharray={value === 0 ? undefined : "2 5"}
              />
              <text x={PAD.left - 8} y={y(value)} textAnchor="end" dominantBaseline="central" className="fill-faint" fontSize={12}>
                {value}
              </text>
            </g>
          ))}

          {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
          {count > 1 ? (
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          ) : null}

          {points.map((point, index) => {
            const isActive = active === index;
            return (
              <g key={point.id}>
                {(count - 1 - index) % step === 0 ? (
                  <text x={x(index)} y={height - 9} textAnchor="middle" className="fill-faint" fontSize={12}>
                    {formatDay(point.date).split(", ")[1]}
                  </text>
                ) : null}
                {isActive ? <circle cx={x(index)} cy={y(point.score)} r={11} fill="var(--primary)" fillOpacity={0.18} /> : null}
                <circle
                  cx={x(index)}
                  cy={y(point.score)}
                  r={isActive ? 6 : 4.5}
                  fill="var(--background)"
                  stroke="var(--primary)"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                {/* An invisible, larger circle is the real target: 32px across is comfortable for a finger. */}
                <circle
                  cx={x(index)}
                  cy={y(point.score)}
                  r={16}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${categoryLabel(point.category)}, ${formatDay(point.date)}: ${point.score} out of 100`}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => setActive(index)}
                  // A mouse leaving closes the tooltip. A finger lifting does not fire this, so a tapped
                  // tooltip stays until the next tap (the background rect above clears it).
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  style={{ outline: "none", cursor: "pointer" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {current ? (
        <div
          className={`pointer-events-none absolute z-10 -translate-x-1/2 ${tooltipBelow ? "" : "-translate-y-full"} rounded-lg border border-line-strong bg-raised px-3 py-2 text-xs shadow-pop`}
          style={{ left: tooltipLeft, top: y(current.score), marginTop: tooltipBelow ? 14 : -14 }}
        >
          <p className="font-serif text-base leading-none font-semibold">{current.score}</p>
          <p className="mt-1 whitespace-nowrap text-muted">
            {categoryLabel(current.category)} · {formatDay(current.date)}
          </p>
        </div>
      ) : null}

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-coral" aria-hidden="true" />
          Under 50: needs work
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          50 to 74: on track
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sage" aria-hidden="true" />
          75 and up: interview ready
        </span>
      </figcaption>
    </figure>
  );
}
