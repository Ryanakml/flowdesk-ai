import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@flowdesk/ui";

export function AnalyticsRangeSelect({
  value,
  onChange,
  label
}: {
  value: number;
  onChange: (days: number) => void;
  label: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(val) => onChange(Number(val))}>
      <SelectTrigger aria-label={label} className="h-8 w-36 text-xs">
        <SelectValue placeholder="Select timeframe" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
        <SelectItem value="365">Last 12 months</SelectItem>
      </SelectContent>
    </Select>
  );
}
