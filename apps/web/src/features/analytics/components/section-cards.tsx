import { TrendingUp } from "lucide-react";
import { Badge } from "@flowdesk/ui";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../../components/ui/card.js";

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
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Total Conversations */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>TOTAL CONVERSATIONS</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {overview.totalConversations}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUp className="size-3 mr-1" />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-emerald-600 dark:text-emerald-400">
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
          <CardDescription>BOT AUTOMATION RATE</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {overview.botAutomationRate}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">AI Copilot</Badge>
          </CardAction>
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
          <CardDescription>SLA COMPLIANCE</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600 dark:text-emerald-400">
            {overview.slaMetPercentage}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Target 95%</Badge>
          </CardAction>
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
          <CardDescription>AVG RESOLUTION TIME</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {Math.round(overview.avgResolutionTimeSeconds / 60)}m
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Operator Speed</Badge>
          </CardAction>
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
