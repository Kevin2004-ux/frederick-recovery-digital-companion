import {
  ActivationCodeStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import {
  ClinicStatusReason,
  ClinicStatusLogSignal,
  deriveClinicOperationalStatus,
  extractRedFlags,
  formatClinicStatusReasonLabel,
  getPrimaryClinicStatusReason,
} from "./clinicStatus.js";

type AlertContext = {
  patientUserId: string;
  clinicTag: string;
  activationCodeId: string;
  recoveryStartDate: string | null;
  recentLogs: ClinicStatusLogSignal[];
};

export type OperationalAlertSummary = {
  id: string;
  patientUserId: string;
  clinicTag: string;
  type: OperationalAlertType;
  severity: OperationalAlertSeverity;
  status: OperationalAlertStatus;
  reasons: ClinicStatusReason[];
  summary: string | null;
  triggeredAt: Date;
  resolvedAt: Date | null;
};

const URGENT_RED_FLAG_PATTERNS = [
  /fever/i,
  /shortness of breath/i,
  /chest pain/i,
  /heavy bleeding/i,
  /breathing suddenly much harder/i,
  /lips turning blue/i,
  /face drooping/i,
  /speech difficulty/i,
  /hard to wake up/i,
  /confusion/i,
] as const;

function parseReasonArray(value: unknown): ClinicStatusReason[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (reason): reason is ClinicStatusReason => typeof reason === "string"
  );
}

function getUrgentRedFlags(redFlags: string[]): string[] {
  return Array.from(
    new Set(
      redFlags.filter((flag) =>
        URGENT_RED_FLAG_PATTERNS.some((pattern) => pattern.test(flag))
      )
    )
  );
}

function buildDedupeKey(
  clinicTag: string,
  patientUserId: string,
  type: OperationalAlertType
): string {
  return `operational:${clinicTag}:${patientUserId}:${type}`;
}

function resolveOperationalRecoveryStartDate(args: {
  planStartDate?: string | null;
  profileRecoveryStartDate?: string | null;
}): string | null {
  return args.planStartDate ?? args.profileRecoveryStartDate ?? null;
}

function buildAlertSummary(reasons: readonly ClinicStatusReason[]): string | null {
  const primaryReason = getPrimaryClinicStatusReason(reasons);
  return formatClinicStatusReasonLabel(primaryReason);
}

function summarizeAlertSeverity(
  alerts: Array<{ severity: OperationalAlertSeverity }>
): OperationalAlertSeverity | null {
  if (alerts.some((alert) => alert.severity === OperationalAlertSeverity.URGENT)) {
    return OperationalAlertSeverity.URGENT;
  }

  return alerts.length > 0 ? OperationalAlertSeverity.REVIEW : null;
}

async function loadAlertContext(args: {
  patientUserId: string;
  clinicTag?: string | null;
}): Promise<AlertContext | null> {
  const activation = await prisma.activationCode.findFirst({
    where: {
      claimedByUserId: args.patientUserId,
      status: ActivationCodeStatus.CLAIMED,
      clinicTag: args.clinicTag ?? { not: null },
    },
    orderBy: { claimedAt: "desc" },
    select: {
      id: true,
      clinicTag: true,
      claimedByUser: {
        select: {
          recoveryStartDate: true,
        },
      },
    },
  });

  if (!activation?.clinicTag) {
    return null;
  }

  const [latestPlan, recentLogs] = await Promise.all([
    prisma.recoveryPlanInstance.findFirst({
      where: { userId: args.patientUserId },
      orderBy: { createdAt: "desc" },
      select: { startDate: true },
    }),
    prisma.logEntry.findMany({
      where: { userId: args.patientUserId },
      orderBy: { date: "desc" },
      take: 3,
      select: {
        date: true,
        painLevel: true,
        swellingLevel: true,
        details: true,
      },
    }),
  ]);

  return {
    patientUserId: args.patientUserId,
    clinicTag: activation.clinicTag,
    activationCodeId: activation.id,
    recoveryStartDate: resolveOperationalRecoveryStartDate({
      planStartDate: latestPlan?.startDate ?? null,
      profileRecoveryStartDate: activation.claimedByUser?.recoveryStartDate ?? null,
    }),
    recentLogs,
  };
}

function buildDesiredAlert(context: AlertContext) {
  const status = deriveClinicOperationalStatus({
    recoveryStartDate: context.recoveryStartDate,
    recentLogs: context.recentLogs,
  });

  const recentRedFlags = context.recentLogs.flatMap((log) =>
    extractRedFlags(log.details)
  );
  const urgentRedFlags = getUrgentRedFlags(recentRedFlags);
  const hasOnlySetupMissingDate =
    context.recentLogs.length === 0 &&
    status.reasons.length === 1 &&
    status.reasons[0] === "missing_recovery_start_date";

  if (status.simpleStatus === "ON_TRACK" || hasOnlySetupMissingDate) {
    return null;
  }

  const type =
    status.simpleStatus === "MISSED_CHECK_IN"
      ? OperationalAlertType.MISSED_CHECK_IN
      : OperationalAlertType.REVIEW_SIGNAL;

  const severity =
    urgentRedFlags.length > 0
      ? OperationalAlertSeverity.URGENT
      : OperationalAlertSeverity.REVIEW;

  return {
    type,
    severity,
    dedupeKey: buildDedupeKey(context.clinicTag, context.patientUserId, type),
    reasons: status.reasons,
    summary: buildAlertSummary(status.reasons),
    details: {
      currentRecoveryDay: status.currentRecoveryDay,
      recoveryStartDate: context.recoveryStartDate,
      latestLogDate: context.recentLogs[0]?.date ?? null,
      latestPainLevel: context.recentLogs[0]?.painLevel ?? null,
      latestSwellingLevel: context.recentLogs[0]?.swellingLevel ?? null,
      recentRedFlags,
      urgentRedFlags,
      summary: buildAlertSummary(status.reasons),
    },
  };
}

export async function syncOperationalAlertsForPatient(
  patientUserId: string,
  clinicTag?: string | null
) {
  const context = await loadAlertContext({ patientUserId, clinicTag });
  const now = new Date();

  if (!context) {
    await prisma.operationalAlert.updateMany({
      where: {
        patientUserId,
        ...(clinicTag ? { clinicTag } : {}),
        status: OperationalAlertStatus.OPEN,
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now,
      },
    });
    return;
  }

  const desiredAlert = buildDesiredAlert(context);

  await prisma.$transaction(async (tx) => {
    if (!desiredAlert) {
      await tx.operationalAlert.updateMany({
        where: {
          patientUserId,
          clinicTag: context.clinicTag,
          status: OperationalAlertStatus.OPEN,
        },
        data: {
          status: OperationalAlertStatus.RESOLVED,
          resolvedAt: now,
        },
      });
      return;
    }

    await tx.operationalAlert.upsert({
      where: { dedupeKey: desiredAlert.dedupeKey },
      update: {
        patientUserId: context.patientUserId,
        clinicTag: context.clinicTag,
        activationCodeId: context.activationCodeId,
        type: desiredAlert.type,
        severity: desiredAlert.severity,
        status: OperationalAlertStatus.OPEN,
        reasonsJson: desiredAlert.reasons as Prisma.InputJsonValue,
        detailsJson: desiredAlert.details as Prisma.InputJsonValue,
        triggeredAt: now,
        resolvedAt: null,
      },
      create: {
        patientUserId: context.patientUserId,
        clinicTag: context.clinicTag,
        activationCodeId: context.activationCodeId,
        type: desiredAlert.type,
        severity: desiredAlert.severity,
        status: OperationalAlertStatus.OPEN,
        reasonsJson: desiredAlert.reasons as Prisma.InputJsonValue,
        detailsJson: desiredAlert.details as Prisma.InputJsonValue,
        dedupeKey: desiredAlert.dedupeKey,
        triggeredAt: now,
      },
    });

    await tx.operationalAlert.updateMany({
      where: {
        patientUserId: context.patientUserId,
        status: OperationalAlertStatus.OPEN,
        dedupeKey: { not: desiredAlert.dedupeKey },
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now,
      },
    });
  });
}

export async function syncOperationalAlertsForPatients(
  patientUserIds: string[],
  clinicTag?: string | null
) {
  const uniquePatientUserIds = Array.from(new Set(patientUserIds.filter(Boolean)));

  for (const patientUserId of uniquePatientUserIds) {
    await syncOperationalAlertsForPatient(patientUserId, clinicTag);
  }
}

export async function listOpenOperationalAlerts(args: {
  patientUserIds?: string[];
  patientUserId?: string;
  clinicTag?: string | null;
}) {
  const patientUserIds = args.patientUserIds?.length
    ? Array.from(new Set(args.patientUserIds.filter(Boolean)))
    : args.patientUserId
      ? [args.patientUserId]
      : [];

  if (patientUserIds.length === 0) return [];

  const alerts = await prisma.operationalAlert.findMany({
    where: {
      patientUserId: { in: patientUserIds },
      status: OperationalAlertStatus.OPEN,
      ...(args.clinicTag ? { clinicTag: args.clinicTag } : {}),
    },
    orderBy: [{ triggeredAt: "desc" }],
    select: {
      id: true,
      patientUserId: true,
      clinicTag: true,
      type: true,
      severity: true,
      status: true,
      reasonsJson: true,
      triggeredAt: true,
      resolvedAt: true,
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    patientUserId: alert.patientUserId,
    clinicTag: alert.clinicTag,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    reasons: parseReasonArray(alert.reasonsJson),
    summary: buildAlertSummary(parseReasonArray(alert.reasonsJson)),
    triggeredAt: alert.triggeredAt,
    resolvedAt: alert.resolvedAt,
  })) satisfies OperationalAlertSummary[];
}

export function highestOpenOperationalAlertSeverity(
  alerts: Array<{ severity: OperationalAlertSeverity }>
) {
  return summarizeAlertSeverity(alerts);
}
