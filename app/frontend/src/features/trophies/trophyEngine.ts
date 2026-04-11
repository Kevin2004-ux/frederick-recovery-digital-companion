import type { RecoveryLogEntry } from "@/types/log";

export interface TrophySummary {
  currentStreak: number;
  longestStreak: number;
  consistencyLabel: string;
}

function sortDates(entries: RecoveryLogEntry[]) {
  return [...entries].sort((left, right) => left.date.localeCompare(right.date));
}

function isNextDay(previous: string, current: string) {
  const previousDate = new Date(`${previous}T00:00:00`);
  const currentDate = new Date(`${current}T00:00:00`);
  return currentDate.getTime() - previousDate.getTime() === 86400000;
}

export function calculateTrophySummary(entries: RecoveryLogEntry[]): TrophySummary {
  const sorted = sortDates(entries);
  let longest = 0;
  let running = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    if (index === 0 || isNextDay(sorted[index - 1].date, sorted[index].date)) {
      running += 1;
    } else {
      running = 1;
    }

    longest = Math.max(longest, running);
  }

  let current = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (index === sorted.length - 1) {
      current = 1;
      continue;
    }
    if (isNextDay(sorted[index].date, sorted[index + 1].date)) {
      current += 1;
      continue;
    }
    break;
  }

  const consistencyLabel =
    longest >= 10 ? "Strong consistency" : longest >= 5 ? "Steady momentum" : "Building the habit";

  return {
    currentStreak: current,
    longestStreak: longest,
    consistencyLabel,
  };
}
