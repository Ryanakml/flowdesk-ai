import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@flowdesk/ui";
import {
  type AnalyticsMetricsClientResponse,
  exportAnalyticsReportApi,
  getAnalyticsMetricsApi
} from "./api.js";
import { SectionCards } from "./features/analytics/components/section-cards.js";
import { ChartAreaInteractive } from "./features/analytics/components/chart-area-interactive.js";
import { RecentChats } from "./features/analytics/components/recent-chats.js";
import { AnalyticsRangeSelect } from "./features/analytics/components/analytics-range-select.js";

export interface AnalyticsViewProps {
  orgId: string;
}

export function AnalyticsView({ orgId }: AnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsMetricsClientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<number>(30);

  const tableSeries = useMemo(() => {
    const series = data?.volumeSeries ?? [];
    if (timeRange !== 365) return series;
    const monthly = new Map<
      string,
      { date: string; inbound: number; outbound: number; bot: number }
    >();
    for (const point of series) {
      const month = point.date.slice(0, 7);
      const current = monthly.get(month) ?? { date: month, inbound: 0, outbound: 0, bot: 0 };
      current.inbound += point.inbound;
      current.outbound += point.outbound;
      current.bot += point.bot;
      monthly.set(month, current);
    }
    return Array.from(monthly.values());
  }, [data?.volumeSeries, timeRange]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetrics() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAnalyticsMetricsApi(orgId, timeRange);
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics metrics");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [orgId, timeRange]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const blob = await exportAnalyticsReportApi(orgId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowdesk-analytics-${orgId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Loading real-time analytics data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="m-6 rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-destructive">
        <h3 className="mb-2 font-semibold">Analytics Unavailable</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const overview = data?.overview ?? {
    totalConversations: 0,
    openConversations: 0,
    assignedConversations: 0,
    resolvedConversations: 0,
    totalMessages: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    botMessages: 0,
    humanMessages: 0,
    botAutomationRate: 0,
    slaMetPercentage: 0,
    avgFirstResponseTimeSeconds: 0,
    avgResolutionTimeSeconds: 0
  };

  return (
    <div
      className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8"
      data-testid="analytics-view"
      aria-busy={loading}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Real-Time Analytics & SLA Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor operational conversation throughput, bot automation efficiency, and SLA
            compliance metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsRangeSelect
            value={timeRange}
            onChange={setTimeRange}
            label="Analytics date range"
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              void handleExportCSV();
            }}
            disabled={exporting}
            className="cursor-pointer"
          >
            <Download className="mr-2 size-4" />
            {exporting ? "Generating CSV..." : "Export Compliance CSV"}
          </Button>
        </div>
      </div>

      <SectionCards overview={overview} volumeSeries={tableSeries} />

      <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <ChartAreaInteractive
          volumeSeries={tableSeries}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
        <RecentChats orgId={orgId} />
      </div>

      {/* Daily Volume & Breakdown Table */}
      <div className="analytics-panel rounded-xl border p-4 sm:p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Daily Message Volume & Automation Breakdown
        </h3>

        {tableSeries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No message activity recorded for the selected date range.
          </p>
        ) : (
          <div className="scrollbar-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Inbound</th>
                  <th className="px-4 py-3 text-center">Outbound</th>
                  <th className="px-4 py-3 text-center">Bot Handled</th>
                  <th className="px-4 py-3 text-center">Automation Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableSeries.map((pt) => {
                  const dayTotal = pt.inbound + pt.outbound;
                  const share = dayTotal > 0 ? Math.round((pt.bot / dayTotal) * 100) : 0;
                  return (
                    <tr key={pt.date} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{pt.date}</td>
                      <td className="px-4 py-3 text-center font-mono text-chart-1">{pt.inbound}</td>
                      <td className="px-4 py-3 text-center font-mono text-success">
                        {pt.outbound}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-destructive">{pt.bot}</td>
                      <td className="px-4 py-3 text-center font-mono text-foreground">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
