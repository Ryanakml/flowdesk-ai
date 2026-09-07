import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@flowdesk/ui";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../components/ui/card.js";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "../../../components/ui/chart.js";

export interface VolumeDataPoint {
  date: string;
  inbound: number;
  outbound: number;
  bot: number;
}

const chartConfig = {
  inbound: {
    label: "Inbound Messages",
    color: "var(--primary)"
  },
  outbound: {
    label: "Outbound Messages",
    color: "var(--success)"
  },
  bot: {
    label: "Bot Automated",
    color: "var(--destructive)"
  }
} satisfies ChartConfig;

interface ChartAreaInteractiveProps {
  volumeSeries: VolumeDataPoint[];
  timeRange: number;
  onTimeRangeChange: (days: number) => void;
}

export function ChartAreaInteractive({
  volumeSeries,
  timeRange,
  onTimeRangeChange
}: ChartAreaInteractiveProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Message Throughput & Automation Trends</CardTitle>
        <CardDescription>
          Daily distribution of inbound, outbound agent, and automated AI responses.
        </CardDescription>
        <CardAction>
          <div className="w-40">
            <Select
              value={String(timeRange)}
              onValueChange={(val) => onTimeRangeChange(Number(val))}
            >
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={volumeSeries} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="fillInbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-inbound)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-inbound)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillOutbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-outbound)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-outbound)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillBot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-bot)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-bot)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <YAxis domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.15))]} hide />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(value: unknown) => {
                if (typeof value === "string" || typeof value === "number") {
                  try {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric"
                    });
                  } catch {
                    return String(value);
                  }
                }
                return "";
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value: unknown) => {
                    if (typeof value === "string" || typeof value === "number") {
                      try {
                        return new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        });
                      } catch {
                        return String(value);
                      }
                    }
                    return "";
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="inbound"
              type="natural"
              fill="url(#fillInbound)"
              stroke="var(--color-inbound)"
              name="Inbound"
            />
            <Area
              dataKey="outbound"
              type="natural"
              fill="url(#fillOutbound)"
              stroke="var(--color-outbound)"
              name="Outbound"
            />
            <Area
              dataKey="bot"
              type="natural"
              fill="url(#fillBot)"
              stroke="var(--color-bot)"
              name="Bot Handled"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
