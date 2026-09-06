import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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
    color: "#2563eb"
  },
  outbound: {
    label: "Outbound Messages",
    color: "#16a34a"
  },
  bot: {
    label: "Bot Automated",
    color: "#9333ea"
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
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={volumeSeries}>
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
              stroke="#2563eb"
              name="Inbound"
            />
            <Area
              dataKey="outbound"
              type="natural"
              fill="url(#fillOutbound)"
              stroke="#16a34a"
              name="Outbound"
            />
            <Area
              dataKey="bot"
              type="natural"
              fill="url(#fillBot)"
              stroke="#9333ea"
              name="Bot Handled"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
