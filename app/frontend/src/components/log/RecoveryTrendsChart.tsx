import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";

type RecoveryTrendEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
};

type RecoveryTrendsChartProps = {
  entries: RecoveryTrendEntry[];
};

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

function formatTick(dateString: string) {
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTooltipLabel(label: unknown) {
  const dateString = typeof label === "string" ? label : String(label ?? "");
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function RecoveryTrendsChart({
  entries,
}: RecoveryTrendsChartProps) {
  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(-14)
      .map((entry) => ({
        date: entry.date,
        painLevel: entry.painLevel,
        swellingLevel: entry.swellingLevel,
      }));
  }, [entries]);

  if (chartData.length < 2) {
    return (
      <Card className="rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Recovery trends
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Your recovery trends will appear here after a few check-ins.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Recovery trends
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Pain and swelling from your last 14 check-ins.
          </p>
        </div>

        <div className="h-[260px] w-full sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            >
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 10]}
                tickCount={6}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid hsl(var(--border))",
                  background: "hsla(0, 0%, 100%, 0.96)",
                  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
                }}
                labelFormatter={formatTooltipLabel}
              />
              <Line
                type="monotone"
                dataKey="painLevel"
                name="Pain level"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--chart-1))", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="swellingLevel"
                name="Swelling level"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--chart-2))", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-50 px-3 py-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "hsl(var(--chart-1))" }}
            />
            Pain level
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-50 px-3 py-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "hsl(var(--chart-2))" }}
            />
            Swelling level
          </div>
        </div>
      </div>
    </Card>
  );
}
