"use client";

// Tiny dependency-free inline SVG sparkline. Renders a smooth-ish polyline from
// numeric values. Mobile-first; sizing controlled by props. Guards empty input.
export function Sparkline({
  values,
  width = 64,
  height = 24,
  color = "currentColor",
  strokeWidth = 1.5,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  const clean = (values ?? []).filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  if (clean.length === 1) clean.push(clean[0]);

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const pad = strokeWidth;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const step = usableW / (clean.length - 1);

  const points = clean.map((v, i) => {
    const x = pad + i * step;
    const y = pad + usableH - ((v - min) / range) * usableH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const lastY = points.at(-1)?.split(",")[1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ color }}
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastY != null && (
        <circle cx={(pad + (clean.length - 1) * step).toFixed(2)} cy={lastY} r={strokeWidth} fill="currentColor" />
      )}
    </svg>
  );
}
