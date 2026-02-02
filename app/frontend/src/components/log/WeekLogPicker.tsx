import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type LogEntry = {
  date: string; // YYYY-MM-DD
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 0) {
  // 0=Sun, 1=Mon
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekLogPicker(props: {
  entries: LogEntry[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (d: string) => void;

  // Rolling window constraints
  windowDays?: number; // default 30
  weekStartsOn?: 0 | 1; // default Sunday
}) {
  const { entries, selectedDate, onSelectDate } = props;
  const windowDays = props.windowDays ?? 30;
  const weekStartsOn = props.weekStartsOn ?? 0;

  const byDate = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) s.add(e.date);
    return s;
  }, [entries]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // rolling window: [minDate .. maxDate] inclusive
  const maxDate = today;
  const minDate = useMemo(() => addDays(maxDate, -(windowDays - 1)), [maxDate, windowDays]);

  const selected = useMemo(() => {
    const d = parseYmd(selectedDate);
    d.setHours(0, 0, 0, 0);
    // clamp if out of range
    if (d < minDate) return minDate;
    if (d > maxDate) return maxDate;
    return d;
  }, [selectedDate, minDate, maxDate]);

  const weekStart = useMemo(() => startOfWeek(selected, weekStartsOn), [selected, weekStartsOn]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const ds = ymd(d);
      return {
        date: ds,
        dayName: WD[d.getDay()],
        dayNum: d.getDate(),
        inWindow: d >= minDate && d <= maxDate,
        hasEntry: byDate.has(ds),
      };
    });
  }, [weekStart, minDate, maxDate, byDate]);

  // navigation: move exactly 7 days, but keep weekStart inside window
  const canPrev = useMemo(() => {
    const prevStart = addDays(weekStart, -7);
    const prevEnd = addDays(prevStart, 6);
    // allow if any part of that week intersects window
    return prevEnd >= minDate;
  }, [weekStart, minDate]);

  const canNext = useMemo(() => {
    const nextStart = addDays(weekStart, 7);
    // allow if weekStart is not beyond maxDate
    return nextStart <= maxDate;
  }, [weekStart, maxDate]);

  function goPrevWeek() {
    if (!canPrev) return;
    const prevStart = addDays(weekStart, -7);
    // pick a sensible selected date inside window (use same weekday if possible)
    const candidate = addDays(prevStart, 0);
    const clamped = candidate < minDate ? minDate : candidate;
    onSelectDate(ymd(clamped));
  }

  function goNextWeek() {
    if (!canNext) return;
    const nextStart = addDays(weekStart, 7);
    const candidate = addDays(nextStart, 0);
    const clamped = candidate > maxDate ? maxDate : candidate;
    onSelectDate(ymd(clamped));
  }

  const rangeLabel = useMemo(() => {
    const a = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const b = addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `Week ${a} – ${b}`;
  }, [weekStart]);

  const windowLabel = useMemo(() => {
    const a = minDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const b = maxDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `Showing last ${windowDays} days • ${a} – ${b}`;
  }, [minDate, maxDate, windowDays]);

  return (
    <Card className="rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">{rangeLabel}</div>
          <div className="text-xs text-muted-foreground">{windowLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={goPrevWeek}
            disabled={!canPrev}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={goNextWeek}
            disabled={!canNext}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d) => {
          const isSelected = d.date === ymd(selected);
          return (
            <button
              key={d.date}
              type="button"
              disabled={!d.inWindow}
              onClick={() => onSelectDate(d.date)}
              className={[
                "rounded-2xl border px-2 py-3 text-center transition",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "hover:bg-muted/40",
                isSelected ? "border-primary/60 bg-muted/30" : "",
              ].join(" ")}
            >
              <div className="text-[11px] text-muted-foreground">{d.dayName}</div>
              <div className="mt-1 text-base font-semibold">{d.dayNum}</div>
              <div className="mt-2 flex justify-center">
                {d.hasEntry ? <span className="h-2 w-2 rounded-full bg-primary" /> : <span className="h-2 w-2 rounded-full bg-transparent border" />}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
