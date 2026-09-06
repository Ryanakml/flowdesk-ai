import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@flowdesk/ui";
import {
  type AnalyticsMetricsClientResponse,
  exportAnalyticsReportApi,
  getAnalyticsMetricsApi
} from "./api.js";
import { SectionCards } from "./features/analytics/components/section-cards.js";
import { ChartAreaInteractive } from "./features/analytics/components/chart-area-interactive.js";

export interface AnalyticsViewProps {
  orgId: string;
}

export function AnalyticsView({ orgId }: AnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsMetricsClientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<number>(30);

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
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
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

  const volumeSeries = data?.volumeSeries ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
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

        <div className="flex items-center gap-3">
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
            {exporting ? "Generating CSV..." : "📥 Export Compliance CSV"}
          </Button>
        </div>
      </div>

      {/* KPI Cards transplanted from donor section cards */}
      <SectionCards overview={overview} />

      {/* Interactive area chart transplanted from donor dashboard */}
      <ChartAreaInteractive
        volumeSeries={volumeSeries}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Daily Volume & Breakdown Table */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Daily Message Volume & Automation Breakdown
        </h3>

        {volumeSeries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No message activity recorded for the selected date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Inbound Messages</th>
                  <th className="px-4 py-3">Outbound Messages</th>
                  <th className="px-4 py-3">Bot Handled</th>
                  <th className="px-4 py-3">Automation Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {volumeSeries.map((pt) => {
                  const dayTotal = pt.inbound + pt.outbound;
                  const share = dayTotal > 0 ? Math.round((pt.bot / dayTotal) * 100) : 0;
                  return (
                    <tr key={pt.date} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{pt.date}</td>
                      <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-mono">
                        {pt.inbound}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-mono">
                        {pt.outbound}
                      </td>
                      <td className="px-4 py-3 text-purple-600 dark:text-purple-400 font-mono">
                        {pt.bot}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {share}%
                        </span>
                      </td>
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
