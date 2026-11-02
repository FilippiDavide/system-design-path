import type { ReactNode, SVGProps } from "react";

/**
 * Tiny SVG vocabulary shared by every hand-drawn diagram: boxes,
 * cylinders, arrows and labels. Everything is 1.5px black line work on
 * white; neon is passed in explicitly where a figure needs emphasis.
 */

export const NEON = {
  blue: "var(--neon-1)",
  magenta: "var(--neon-2)",
  green: "var(--neon-3)",
  violet: "var(--neon-4)",
  orange: "var(--neon-5)",
} as const;

export const INK = "var(--ink)";
export const INK2 = "var(--ink-2)";
export const SOFT = "var(--line-soft)";
export const MONO = "var(--font-jetbrains), ui-monospace, monospace";
export const SANS = "var(--font-inter), system-ui, sans-serif";

/** Shared `<defs>`: arrowheads in ink and in each neon. */
export function Defs() {
  const heads: [string, string][] = [
    ["ink", INK],
    ["blue", NEON.blue],
    ["magenta", NEON.magenta],
    ["green", NEON.green],
    ["violet", NEON.violet],
    ["orange", NEON.orange],
    ["soft", INK2],
  ];
  return (
    <defs>
      {heads.map(([id, color]) => (
        <marker
          key={id}
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

/** Responsive SVG canvas with a fixed design viewBox. */
export function Canvas({
  w,
  h,
  minWidth = 560,
  children,
  ...rest
}: { w: number; h: number; minWidth?: number; children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ minWidth, maxWidth: w * 1.15, display: "block", margin: "0 auto" }}
      role="img"
      {...rest}
    >
      <Defs />
      {children}
    </svg>
  );
}

/** Multi-line text; lines separated by `\n`. */
export function Label({
  x,
  y,
  lines,
  size = 12,
  weight = 500,
  anchor = "middle",
  color = INK,
  mono = false,
  upper = false,
  lineHeight = 1.3,
}: {
  x: number;
  y: number;
  lines: string | string[];
  size?: number;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  color?: string;
  mono?: boolean;
  upper?: boolean;
  lineHeight?: number;
}) {
  const arr = Array.isArray(lines) ? lines : lines.split("\n");
  const total = (arr.length - 1) * size * lineHeight;
  return (
    <text
      x={x}
      y={y - total / 2}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontFamily={mono ? MONO : SANS}
      fontSize={size}
      fontWeight={weight}
      fill={color}
      style={{ textTransform: upper ? "uppercase" : undefined, letterSpacing: upper ? "0.08em" : undefined }}
    >
      {arr.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * lineHeight}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Rectangular node. */
export function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
  fill = "#fff",
  dashed = false,
  titleSize = 13,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: string;
  fill?: string;
  dashed?: boolean;
  titleSize?: number;
}) {
  const subLines = sub ? sub.split("\n").length : 0;
  const titleY = sub ? y + h / 2 - (subLines * 11 * 1.3) / 2 - 2 : y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fill}
        stroke={accent ?? INK}
        strokeWidth={accent ? 2 : 1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      {accent && <rect x={x} y={y} width={6} height={h} fill={accent} />}
      <Label x={x + w / 2 + (accent ? 3 : 0)} y={titleY} lines={title} size={titleSize} weight={600} />
      {sub && (
        <Label
          x={x + w / 2 + (accent ? 3 : 0)}
          y={titleY + titleSize * 0.7 + (subLines * 11 * 1.3) / 2 + 2}
          lines={sub}
          size={11}
          weight={400}
          color={INK2}
          mono
        />
      )}
    </g>
  );
}

/** Database cylinder. */
export function Cylinder({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
  fill = "#fff",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: string;
  fill?: string;
}) {
  const ry = Math.min(9, h / 6);
  const stroke = accent ?? INK;
  return (
    <g>
      <path
        d={`M${x} ${y + ry} v${h - 2 * ry} a${w / 2} ${ry} 0 0 0 ${w} 0 v-${h - 2 * ry}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} fill={accent ? accent : "#fff"} stroke={stroke} strokeWidth={1.5} />
      <Label x={x + w / 2} y={y + ry + (h - ry) / 2 - (sub ? 7 : 0)} lines={title} size={12} weight={600} />
      {sub && <Label x={x + w / 2} y={y + ry + (h - ry) / 2 + 12} lines={sub} size={10} color={INK2} mono />}
    </g>
  );
}

/**
 * Arrow along a polyline. `pts` is a flat list of x,y pairs.
 * Labels sit at the midpoint of the longest segment.
 */
export function Arrow({
  pts,
  color = "ink",
  dashed = false,
  label,
  labelOffset = -8,
  width = 1.5,
  noHead = false,
}: {
  pts: number[];
  color?: keyof typeof NEON | "ink" | "soft";
  dashed?: boolean;
  label?: string;
  labelOffset?: number;
  width?: number;
  noHead?: boolean;
}) {
  const stroke = color === "ink" ? INK : color === "soft" ? INK2 : NEON[color];
  const d = pts.reduce((acc, v, i) => (i % 2 === 0 ? `${acc}${i === 0 ? "M" : "L"}${v} ` : `${acc}${v} `), "");
  // Find the longest segment for the label.
  let best = 0;
  let bi = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    if (len > best) {
      best = len;
      bi = i;
    }
  }
  const mx = (pts[bi] + pts[bi + 2]) / 2;
  const my = (pts[bi + 1] + pts[bi + 3]) / 2;
  return (
    <g>
      <path
        d={d.trim()}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd={noHead ? undefined : `url(#arrow-${color})`}
      />
      {label && (
        <Label x={mx} y={my + labelOffset} lines={label} size={10} color={INK2} mono />
      )}
    </g>
  );
}

/** Small filled dot, the Nothing-style marker. */
export function Dot({ x, y, r = 4, color = INK }: { x: number; y: number; r?: number; color?: string }) {
  return <circle cx={x} cy={y} r={r} fill={color} />;
}

/** Thin bracket-style group frame with a label on the top left. */
export function Group({
  x,
  y,
  w,
  h,
  label,
  color = INK2,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={SOFT} strokeWidth={1} strokeDasharray="3 3" />
      <Label x={x + 8} y={y - 9} lines={label} size={10} color={color} mono upper anchor="start" />
    </g>
  );
}
