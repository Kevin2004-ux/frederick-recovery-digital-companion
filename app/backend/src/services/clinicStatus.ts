export type SimpleClinicStatus = "ON_TRACK" | "MISSED_CHECK_IN" | "NEEDS_REVIEW";

export type ClinicStatusReason =
  | "future_recovery_start_date"
  | "missing_recovery_start_date"
  | "invalid_last_check_in_date"
  | "early_recovery_no_check_in_yet"
  | "missed_recent_check_in"
  | "pain_threshold_exceeded"
  | "swelling_threshold_exceeded"
  | "worsening_recent_trend"
  | "critical_red_flag_logged"
  | "recent_check_in_present";

export type ClinicStatusLogSignal = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  details?: unknown;
};

function parseUtcDateFromYmd(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Status comparisons use canonical YYYY-MM-DD fields and UTC-midnight dates.
// This matches the backend's existing date-string storage and avoids local-time rollover drift.
function todayUtcDate(): Date {
  const ymd = new Date().toISOString().slice(0, 10);
  return new Date(`${ymd}T00:00:00.000Z`);
}

function diffDaysUtc(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

export function extractRedFlags(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];

  const rawRedFlags = (details as Record<string, unknown>).redFlags;
  if (!Array.isArray(rawRedFlags)) return [];

  return Array.from(
    new Set(
      rawRedFlags
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function hasWorseningRecentTrend(recentLogs: ClinicStatusLogSignal[]): boolean {
  if (recentLogs.length < 3) return false;

  const sorted = [...recentLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  const painWorsening =
    first.painLevel <= second.painLevel &&
    second.painLevel <= third.painLevel &&
    third.painLevel - first.painLevel >= 2;

  const swellingWorsening =
    first.swellingLevel <= second.swellingLevel &&
    second.swellingLevel <= third.swellingLevel &&
    third.swellingLevel - first.swellingLevel >= 2;

  return painWorsening || swellingWorsening;
}

export function computeCurrentRecoveryDay(startDate: string | null | undefined): number | null {
  const parsedStartDate = parseUtcDateFromYmd(startDate);
  if (!parsedStartDate) return null;

  const diff = diffDaysUtc(todayUtcDate(), parsedStartDate);
  if (diff < 0) return null;

  return diff + 1;
}

export function summarizeMetricTrend(values: number[]) {
  const latest = values.length ? values[values.length - 1] : null;
  const previous = values.length >= 2 ? values[values.length - 2] : null;

  if (values.length < 2) {
    return {
      direction: "INSUFFICIENT_DATA" as const,
      latest,
      previous: null,
    };
  }

  if (latest === null || previous === null) {
    return {
      direction: "INSUFFICIENT_DATA" as const,
      latest,
      previous,
    };
  }

  const diff = latest - previous;

  return {
    direction: diff >= 2 ? "UP" : diff <= -2 ? "DOWN" : "STABLE",
    latest,
    previous,
  } as const;
}

export function deriveClinicOperationalStatus(args: {
  recoveryStartDate?: string | null;
  recentLogs?: ClinicStatusLogSignal[];
}) {
  const reasons: ClinicStatusReason[] = [];
  const recentLogs = [...(args.recentLogs ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const parsedStartDate = parseUtcDateFromYmd(args.recoveryStartDate);
  if (!args.recoveryStartDate || !parsedStartDate) {
    return {
      simpleStatus: "NEEDS_REVIEW" as SimpleClinicStatus,
      reasons: ["missing_recovery_start_date"] as ClinicStatusReason[],
      currentRecoveryDay: null,
    };
  }

  const today = todayUtcDate();
  const startDiff = diffDaysUtc(today, parsedStartDate);

  if (startDiff < 0) {
    return {
      simpleStatus: "ON_TRACK" as SimpleClinicStatus,
      reasons: ["future_recovery_start_date"] as ClinicStatusReason[],
      currentRecoveryDay: null,
    };
  }

  const currentRecoveryDay = startDiff + 1;
  const latestLog = recentLogs[0];

  if (!latestLog) {
    if (currentRecoveryDay >= 3) {
      return {
        simpleStatus: "MISSED_CHECK_IN" as SimpleClinicStatus,
        reasons: ["missed_recent_check_in"] as ClinicStatusReason[],
        currentRecoveryDay,
      };
    }

    return {
      simpleStatus: "ON_TRACK" as SimpleClinicStatus,
      reasons: ["early_recovery_no_check_in_yet"] as ClinicStatusReason[],
      currentRecoveryDay,
    };
  }

  const parsedLastCheckIn = parseUtcDateFromYmd(latestLog.date);
  if (!parsedLastCheckIn) {
    return {
      simpleStatus: "NEEDS_REVIEW" as SimpleClinicStatus,
      reasons: ["invalid_last_check_in_date"] as ClinicStatusReason[],
      currentRecoveryDay,
    };
  }

  const gapDays = diffDaysUtc(today, parsedLastCheckIn);
  if (gapDays > 2) {
    return {
      simpleStatus: "MISSED_CHECK_IN" as SimpleClinicStatus,
      reasons: ["missed_recent_check_in"] as ClinicStatusReason[],
      currentRecoveryDay,
    };
  }

  if (latestLog.painLevel >= 8) {
    reasons.push("pain_threshold_exceeded");
  }

  if (latestLog.swellingLevel >= 8) {
    reasons.push("swelling_threshold_exceeded");
  }

  const recentRedFlags = recentLogs.flatMap((log) => extractRedFlags(log.details));
  if (recentRedFlags.length > 0) {
    reasons.push("critical_red_flag_logged");
  }

  if (hasWorseningRecentTrend(recentLogs)) {
    reasons.push("worsening_recent_trend");
  }

  if (reasons.length > 0) {
    return {
      simpleStatus: "NEEDS_REVIEW" as SimpleClinicStatus,
      reasons,
      currentRecoveryDay,
    };
  }

  return {
    simpleStatus: "ON_TRACK" as SimpleClinicStatus,
    reasons: ["recent_check_in_present"] as ClinicStatusReason[],
    currentRecoveryDay,
  };
}
