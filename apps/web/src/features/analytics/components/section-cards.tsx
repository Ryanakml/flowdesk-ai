import { Card } from "../../../components/ui/card.js";
import { MetricLabel } from "../../../components/MetricLabel.js";
import { ComplianceGauge, MetricSparkline } from "./metric-sparkline.js";
import type { VolumeDataPoint } from "./chart-area-interactive.js";

export interface AnalyticsOverviewData {
  totalConversations: number;
  openConversations: number;
  assignedConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  botMessages: number;
  humanMessages: number;
  botAutomationRate: number;
  slaMetPercentage: number;
  avgFirstResponseTimeSeconds: number;
  avgResolutionTimeSeconds: number;
}

export function SectionCards({
  overview,
  volumeSeries
}: {
  overview: AnalyticsOverviewData;
  volumeSeries: VolumeDataPoint[];
}) {
  const cards = [
    {
      label: "TOTAL CONVERSATIONS",
      explanation: "Unique conversations created during the selected period.",
      value: overview.totalConversations,
      tone: "success",
      detail: `${overview.resolvedConversations} resolved (${overview.openConversations} active)`,
      footnote: `${overview.assignedConversations} currently assigned`,
      series: "inbound" as const,
      chartLabel: "Inbound activity"
    },
    {
      label: "BOT AUTOMATION RATE",
      explanation:
        "The bot automation percentage reported for the selected period. The supporting chart shows automated message volume.",
      value: `${overview.botAutomationRate}%`,
      tone: "primary",
      detail: `${overview.botMessages} bot responses auto-dispatched`,
      footnote: "Grounding across verified sources",
      series: "bot" as const,
      chartLabel: "Automated activity"
    },
    {
      label: "SLA COMPLIANCE",
      explanation:
        "Percentage of conversations meeting the configured response and resolution targets. The gauge shows the current period, not a historical trend.",
      value: `${overview.slaMetPercentage}%`,
      tone: "success",
      detail: `Avg response: ${overview.avgFirstResponseTimeSeconds}s`,
      footnote: "Strict resolution thresholds",
      series: null,
      chartLabel: ""
    },
    {
      label: "AVG RESOLUTION TIME",
      explanation:
        "Average time from conversation start until resolution. The supporting chart shows outbound message volume, not resolution-time history.",
      value: `${Math.round(overview.avgResolutionTimeSeconds / 60)}m`,
      tone: "primary",
      detail: `${overview.humanMessages} human agent responses`,
      footnote: "First contact to resolved",
      series: "outbound" as const,
      chartLabel: "Outbound activity"
    }
  ];
  return (
    <div
      className="grid min-w-0 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4"
      data-testid="analytics-metrics"
    >
      {cards.map((card, index) => (
        <Card
          key={card.label}
          className="analytics-metric-card min-w-0 gap-4 rounded-xl p-5 shadow-none"
          data-tone={card.tone}
          data-testid="analytics-metric"
        >
          <div className="text-[10px] font-medium tracking-wide text-muted-foreground">
            <MetricLabel label={card.label} explanation={card.explanation} />
          </div>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p
              className={`text-3xl font-semibold tracking-tight tabular-nums ${index === 2 ? "text-success" : "text-card-foreground"}`}
            >
              {card.value}
            </p>
            {card.series ? (
              <MetricSparkline
                series={volumeSeries}
                dataKey={card.series}
                label={card.chartLabel}
              />
            ) : (
              <ComplianceGauge value={overview.slaMetPercentage} />
            )}
          </div>
          <div className="space-y-1.5">
            <p
              className={`text-xs font-medium leading-relaxed ${index === 0 ? "text-success" : "text-card-foreground"}`}
            >
              {card.detail}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{card.footnote}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
