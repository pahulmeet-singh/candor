import { COMPETENCY_META, type CompetencyKey } from "@/lib/constants/competencies";

interface CompetencyRadarProps {
  competencies: ReadonlyArray<{ key: CompetencyKey; score: number }>;
  className?: string;
}

const WIDTH = 400;
const HEIGHT = 330;
const RADIUS = 108;
const LABEL_GAP = 20;
const RINGS = [2.5, 5, 7.5, 10];

/**
 * Five axes, one per competency, drawn as a pentagon. Pure SVG maths: axis `i`
 * points at angle `-90deg + i * 72deg`, and a score of `s` out of 10 sits at
 * `s / 10` of the radius along it. Nothing is hidden from screen readers: the
 * report prints the same five numbers as a list beside the chart.
 */
export function CompetencyRadar({ competencies, className }: CompetencyRadarProps) {
  const count = competencies.length;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const at = (index: number, radius: number): [number, number] => [
    Math.cos(angle(index)) * radius,
    Math.sin(angle(index)) * radius,
  ];
  const polygon = (radiusOf: (index: number) => number) =>
    competencies.map((_, index) => at(index, radiusOf(index)).join(",")).join(" ");

  const summary = competencies
    .map((entry) => `${COMPETENCY_META[entry.key].label} ${entry.score} out of 10`)
    .join(", ");

  return (
    <svg
      viewBox={`${-WIDTH / 2} ${-HEIGHT / 2 - 6} ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Competency radar: ${summary}`}
      className={className}
    >
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygon(() => (ring / 10) * RADIUS)}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={ring === 10 ? 1.25 : 1}
          strokeDasharray={ring === 10 ? undefined : "3 4"}
          opacity={ring === 10 ? 0.9 : 0.6}
        />
      ))}

      {competencies.map((entry, index) => {
        const [x, y] = at(index, RADIUS);
        return <line key={entry.key} x1={0} y1={0} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
      })}

      <polygon
        points={polygon((index) => (Math.max(0, Math.min(10, competencies[index].score)) / 10) * RADIUS)}
        fill="var(--primary)"
        fillOpacity={0.2}
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {competencies.map((entry, index) => {
        const [x, y] = at(index, (Math.max(0, Math.min(10, entry.score)) / 10) * RADIUS);
        return <circle key={entry.key} cx={x} cy={y} r={3.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={1.5} />;
      })}

      {competencies.map((entry, index) => {
        const [x, y] = at(index, RADIUS + LABEL_GAP);
        const anchor = Math.abs(x) < 6 ? "middle" : x > 0 ? "start" : "end";
        const below = y > 4;
        // The top label sits right above the chart. Its second line (the score) would land on the
        // top vertex, so that label grows upwards instead of downwards.
        const above = y < -RADIUS;
        return (
          <text
            key={entry.key}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="central"
            className="fill-muted"
            style={{ fontSize: 12.5, fontWeight: 500 }}
          >
            <tspan x={x} dy={above ? "-1.35em" : below ? "0.1em" : "0"}>
              {COMPETENCY_META[entry.key].short}
            </tspan>
            <tspan x={x} dy="1.35em" className="fill-foreground" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {entry.score}/10
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
