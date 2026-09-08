import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { VolumeDataPoint } from "./chart-area-interactive.js";

export function MetricSparkline({
  series,
  dataKey,
  label
}: {
  series: VolumeDataPoint[];
  dataKey: "inbound" | "outbound" | "bot";
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <figure
      className="w-28 shrink-0"
      aria-label={`${label} over ${series.length} reporting intervals. Exact values are in the message volume table.`}
    >
      {series.length ? (
        <div className="h-14" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, (max: number) => Math.max(1, max * 1.2)]} />
              <Area
                dataKey={dataKey}
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={1.5}
                fill={`url(#${id})`}
                dot={
                  series.length === 1
                    ? { r: 2, fill: "var(--chart-1)", stroke: "var(--chart-1)" }
                    : false
                }
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-14 items-center justify-center text-[10px] text-muted-foreground">
          No activity
        </div>
      )}
      <figcaption className="text-right text-[10px] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

export function ComplianceGauge({ value }: { value: number }) {
  return (
    <figure className="w-28 shrink-0">
      <svg
        viewBox="0 0 112 56"
        className="h-14 w-28"
        role="img"
        aria-label={`Current SLA compliance: ${value}%`}
      >
        <path
          d="M12 48 A44 44 0 0 1 100 48"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="5"
          pathLength="100"
        />
        <path
          d="M12 48 A44 44 0 0 1 100 48"
          fill="none"
          stroke="var(--success)"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${Math.max(0, Math.min(100, value))} 100`}
        />
      </svg>
      <figcaption className="text-right text-[10px] text-muted-foreground">
        Current-period SLA
      </figcaption>
    </figure>
  );
}
