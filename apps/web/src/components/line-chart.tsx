"use client";

export type ChartPoint = { date: string; value: number };

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
};

function formatTick(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

function formatValue(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LineChart({
  series,
  height = 180,
}: {
  series: ChartSeries[];
  height?: number;
}) {
  const points = series[0]?.points ?? [];
  if (points.length < 2) {
    return <p className="bank-meta">Not enough days in this range to chart yet.</p>;
  }

  const width = 640;
  const pad = { top: 12, right: 12, bottom: 28, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.abs(rawMax) || 1;
  const padAmount = span * 0.1;
  const min = (rawMin < 0 ? Math.min(0, rawMin) : rawMin) - padAmount;
  const max = (rawMax > 0 ? Math.max(0, rawMax) : rawMax) + padAmount;
  const ySpan = max - min || 1;
  const x = (index: number) =>
    pad.left + (index / Math.max(points.length - 1, 1)) * innerW;
  const y = (value: number) =>
    pad.top + innerH - ((value - min) / ySpan) * innerH;

  const zeroY = min <= 0 && max >= 0 ? y(0) : null;
  const lastIndex = points.length - 1;
  const midIndex = Math.floor(lastIndex / 2);

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" className="line-chart-svg">
        {zeroY != null ? (
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={zeroY}
            y2={zeroY}
            className="line-chart-zero"
          />
        ) : null}
        {series.map((item) => {
          const d = item.points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
            .join(" ");
          return (
            <path
              key={item.id}
              d={d}
              fill="none"
              stroke={item.color}
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        <text x={pad.left} y={height - 8} className="line-chart-tick">
          {formatTick(points[0]!.date)}
        </text>
        <text x={x(midIndex)} y={height - 8} className="line-chart-tick" textAnchor="middle">
          {formatTick(points[midIndex]!.date)}
        </text>
        <text x={width - pad.right} y={height - 8} className="line-chart-tick" textAnchor="end">
          {formatTick(points[lastIndex]!.date)}
        </text>
        <text x={4} y={pad.top + 4} className="line-chart-tick">
          {formatValue(max)}
        </text>
        <text x={4} y={height - pad.bottom} className="line-chart-tick">
          {formatValue(min)}
        </text>
      </svg>
      <div className="line-chart-legend">
        {series.map((item) => {
          const last = item.points[item.points.length - 1];
          return (
            <span key={item.id} className="line-chart-legend-item">
              <span className="line-chart-swatch" style={{ background: item.color }} />
              {item.label}
              {last ? ` · ${formatValue(last.value)}` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
