import { scoreTone, type ScoreTone } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const TONE_COLOR: Record<ScoreTone, string> = {
  low: "var(--coral)",
  mid: "var(--primary)",
  high: "var(--sage)",
};

interface ScoreRingProps {
  /** 0-100. */
  score: number;
  size?: number;
  stroke?: number;
  /** Small text under the number, for example "of 100". */
  caption?: string;
  className?: string;
}

/**
 * A progress ring drawn as two SVG circles: a track, and an arc whose length is
 * `score / 100` of the circumference (via stroke-dasharray). Server-rendered;
 * the colour follows the same bands as the readiness labels.
 */
export function ScoreRing({ score, size = 120, stroke = 10, caption, className }: ScoreRingProps) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div
      role="img"
      aria-label={`Score ${value} out of 100`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--raised-2)" strokeWidth={stroke} />
        {value > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={TONE_COLOR[scoreTone(value)]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif leading-none font-semibold tabular-nums" style={{ fontSize: size * 0.34 }}>
          {value}
        </span>
        {caption ? <span className="mt-1 text-xs text-muted">{caption}</span> : null}
      </div>
    </div>
  );
}
