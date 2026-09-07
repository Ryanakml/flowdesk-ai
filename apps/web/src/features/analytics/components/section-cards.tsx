import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../../components/ui/card.js";
import { MetricLabel } from "../../../components/MetricLabel.js";

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

export function SectionCards({ overview }: { overview: AnalyticsOverviewData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {/* Total Conversations */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            <MetricLabel
              label="TOTAL CONVERSATIONS"
              explanation="Unique conversations created during the selected period."
            />
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {overview.totalConversations}
          </CardTitle>
          <CardAction />
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-success">
            {overview.resolvedConversations} resolved ({overview.openConversations} active)
          </div>
          <div className="text-muted-foreground text-xs">
            {overview.assignedConversations} currently assigned
          </div>
        </CardFooter>
      </Card>

      {/* Bot Automation Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            <MetricLabel
              label="BOT AUTOMATION RATE"
              explanation="Share of outbound messages handled by the bot during the selected period."
            />
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {overview.botAutomationRate}%
          </CardTitle>
          <CardAction />
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {overview.botMessages} bot responses auto-dispatched
          </div>
          <div className="text-muted-foreground text-xs">Grounding across verified sources</div>
        </CardFooter>
      </Card>

      {/* SLA Compliance Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            <MetricLabel
              label="SLA COMPLIANCE"
              explanation="Percentage of conversations meeting the configured response and resolution targets."
            />
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-success">
            {overview.slaMetPercentage}%
          </CardTitle>
          <CardAction />
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Avg response: {overview.avgFirstResponseTimeSeconds}s
          </div>
          <div className="text-muted-foreground text-xs">Strict resolution thresholds</div>
        </CardFooter>
      </Card>

      {/* Avg Resolution Speed */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>
            <MetricLabel
              label="AVG RESOLUTION TIME"
              explanation="Average time from conversation start until resolution."
            />
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {Math.round(overview.avgResolutionTimeSeconds / 60)}m
          </CardTitle>
          <CardAction />
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {overview.humanMessages} human agent responses
          </div>
          <div className="text-muted-foreground text-xs">First contact to resolved</div>
        </CardFooter>
      </Card>
    </div>
  );
}
