import { useId } from "react";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card } from "../../../components/ui/card.js";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "../../../components/ui/chart.js";
import { AnalyticsRangeSelect } from "./analytics-range-select.js";

export interface VolumeDataPoint {
  date: string;
  inbound: number;
  outbound: number;
  bot: number;
}

const chartConfig = {
  inbound: { label: "Inbound", color: "var(--chart-1)" },
  bot: { label: "Automated", color: "var(--chart-2)" },
  outbound: { label: "Outbound", color: "var(--chart-3)" }
} satisfies ChartConfig;

interface ChartAreaInteractiveProps {
  volumeSeries: VolumeDataPoint[];
  timeRange: number;
  onTimeRangeChange: (days: number) => void;
}

function dateLabel(value: unknown, detailed = false) {
  if (typeof value !== "string") return "";
  const monthly = value.length === 7;
  const date = new Date(monthly ? `${value}-01T12:00:00` : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    ...(monthly ? {} : { day: "numeric" as const }),
    ...(detailed || monthly ? { year: "numeric" as const } : {})
  });
}

export function ChartAreaInteractive({
  volumeSeries,
  timeRange,
  onTimeRangeChange
}: ChartAreaInteractiveProps) {
  const gradientId = useId().replace(/:/g, "");
  return (
    <Card
      className="analytics-panel flex h-[380px] min-w-0 gap-4 rounded-xl p-4 shadow-none sm:p-5"
      data-testid="throughput-chart"
    >
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ChartNoAxesColumnIncreasing
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              Message Throughput & Automation Trends
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {timeRange === 365 ? "Monthly" : "Daily"} distribution of inbound, outbound agent, and
              automated AI responses.
            </p>
          </div>
        </div>
        <AnalyticsRangeSelect
          value={timeRange}
          onChange={onTimeRangeChange}
          label="Chart date range"
        />
      </header>
      <div
        className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-foreground"
        aria-label="Chart legend"
      >
        {Object.entries(chartConfig).map(([key, config]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            {config.label}
          </span>
        ))}
      </div>
      {volumeSeries.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          No message activity in this period.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1 aspect-auto">
          <AreaChart data={volumeSeries} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
            <defs>
              {Object.entries(chartConfig).map(([key, config]) => (
                <linearGradient key={key} id={`${gradientId}-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={config.color} stopOpacity={0.015} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.65} />
            <YAxis
              domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.15))]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={30}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={36}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickFormatter={(value: unknown) => dateLabel(value)}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
              allowEscapeViewBox={{ x: false, y: false }}
              content={
                <ChartTooltipContent
                  className="max-w-48 bg-popover text-popover-foreground"
                  labelFormatter={(value: unknown) => dateLabel(value, true)}
                  indicator="dot"
                />
              }
            />
            {(["outbound", "inbound", "bot"] as const).map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                fill={`url(#${gradientId}-${key})`}
                stroke={chartConfig[key].color}
                strokeWidth={1.5}
                name={chartConfig[key].label}
                isAnimationActive={false}
                dot={
                  volumeSeries.length === 1
                    ? { r: 3, fill: chartConfig[key].color, stroke: chartConfig[key].color }
                    : false
                }
                activeDot={{ r: 3, fill: chartConfig[key].color, stroke: "var(--card)" }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}
    </Card>
  );
}
