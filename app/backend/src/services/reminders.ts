import {
  ActivationCodeStatus,
  ReminderStatus,
  ReminderType,
  UserRole,
  Prisma,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { sendDailyCheckInReminderEmail } from "../utils/mailer.js";
import { encryptJsonPHI } from "../utils/encryption.js";

const DAILY_CHECK_IN_REMINDER_WINDOW_DAYS = 21;

function parseUtcDateFromYmd(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Reminder scheduling uses canonical YYYY-MM-DD dates at UTC midnight.
// This matches the rest of the backend's recovery/log date model and avoids local-time rollover drift.
export function getCanonicalReminderDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDaysUtc(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function buildReminderDedupeKey(
  clinicTag: string,
  patientUserId: string,
  scheduledForDate: string
): string {
  return `reminder:${clinicTag}:${patientUserId}:${ReminderType.DAILY_CHECK_IN_EMAIL}:${scheduledForDate}`;
}

export type DailyReminderRunSummary = {
  scheduledForDate: string;
  evaluated: number;
  eligible: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
  skippedAlreadyLoggedToday: number;
  skippedMissingContext: number;
  skippedOutOfWindow: number;
};

export async function runDailyCheckInReminderDigest(
  scheduledForDate = getCanonicalReminderDate()
): Promise<DailyReminderRunSummary> {
  const scheduledDate = parseUtcDateFromYmd(scheduledForDate);
  if (!scheduledDate) {
    throw new Error("INVALID_REMINDER_DATE");
  }

  const claimedActivations = await prisma.activationCode.findMany({
    where: {
      status: ActivationCodeStatus.CLAIMED,
      claimedByUserId: { not: null },
      clinicTag: { not: null },
    },
    orderBy: { claimedAt: "desc" },
    select: {
      id: true,
      clinicTag: true,
      claimedByUserId: true,
      claimedByUser: {
        select: {
          id: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          recoveryPlans: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { startDate: true },
          },
        },
      },
    },
  });

  const latestActivationByPatientId = new Map<
    string,
    (typeof claimedActivations)[number]
  >();

  for (const activation of claimedActivations) {
    const patientUserId = activation.claimedByUserId;
    if (!patientUserId || latestActivationByPatientId.has(patientUserId)) continue;
    latestActivationByPatientId.set(patientUserId, activation);
  }

  const candidateActivations = Array.from(latestActivationByPatientId.values());
  const patientUserIds = candidateActivations
    .map((activation) => activation.claimedByUserId)
    .filter((id): id is string => Boolean(id));

  const [todayLogs, existingOutboxRecords] = await Promise.all([
    patientUserIds.length
      ? prisma.logEntry.findMany({
          where: {
            userId: { in: patientUserIds },
            date: scheduledForDate,
          },
          select: { userId: true },
        })
      : [],
    patientUserIds.length
      ? prisma.reminderOutbox.findMany({
          where: {
            patientUserId: { in: patientUserIds },
            type: ReminderType.DAILY_CHECK_IN_EMAIL,
            scheduledForDate,
          },
          select: {
            id: true,
            dedupeKey: true,
            status: true,
            sentAt: true,
          },
        })
      : [],
  ]);

  const patientIdsWithTodayLog = new Set(todayLogs.map((entry) => entry.userId));
  const existingOutboxByDedupeKey = new Map(
    existingOutboxRecords.map((record) => [record.dedupeKey, record])
  );

  const summary: DailyReminderRunSummary = {
    scheduledForDate,
    evaluated: candidateActivations.length,
    eligible: 0,
    sent: 0,
    failed: 0,
    skippedAlreadySent: 0,
    skippedAlreadyLoggedToday: 0,
    skippedMissingContext: 0,
    skippedOutOfWindow: 0,
  };

  for (const activation of candidateActivations) {
    const patientUserId = activation.claimedByUserId;
    const patient = activation.claimedByUser;
    const clinicTag = activation.clinicTag;
    const recoveryStartDate = patient?.recoveryPlans[0]?.startDate ?? null;

    if (
      !patientUserId ||
      !patient ||
      !clinicTag ||
      patient.role !== UserRole.PATIENT ||
      !patient.emailVerifiedAt
    ) {
      summary.skippedMissingContext += 1;
      continue;
    }

    const parsedStartDate = parseUtcDateFromYmd(recoveryStartDate);
    if (!parsedStartDate) {
      summary.skippedMissingContext += 1;
      continue;
    }

    const currentRecoveryDay = diffDaysUtc(scheduledDate, parsedStartDate) + 1;
    if (currentRecoveryDay < 1 || currentRecoveryDay > DAILY_CHECK_IN_REMINDER_WINDOW_DAYS) {
      summary.skippedOutOfWindow += 1;
      continue;
    }

    if (patientIdsWithTodayLog.has(patientUserId)) {
      summary.skippedAlreadyLoggedToday += 1;
      continue;
    }

    const dedupeKey = buildReminderDedupeKey(clinicTag, patientUserId, scheduledForDate);
    const existingRecord = existingOutboxByDedupeKey.get(dedupeKey);

    if (existingRecord?.status === ReminderStatus.SENT || existingRecord?.sentAt) {
      summary.skippedAlreadySent += 1;
      continue;
    }

    summary.eligible += 1;

    const reminderRecord = await prisma.reminderOutbox.upsert({
      where: { dedupeKey },
      update: {
        patientUserId,
        clinicTag,
        activationCodeId: activation.id,
        type: ReminderType.DAILY_CHECK_IN_EMAIL,
        scheduledForDate,
        status: ReminderStatus.PENDING,
        failedAt: null,
        detailsJson: encryptJsonPHI({
          currentRecoveryDay,
          recoveryStartDate,
          appLinkSource: "frontend_origins_or_localhost",
        }) as Prisma.InputJsonValue,
      },
      create: {
        patientUserId,
        clinicTag,
        activationCodeId: activation.id,
        type: ReminderType.DAILY_CHECK_IN_EMAIL,
        scheduledForDate,
        status: ReminderStatus.PENDING,
        dedupeKey,
        detailsJson: encryptJsonPHI({
          currentRecoveryDay,
          recoveryStartDate,
          appLinkSource: "frontend_origins_or_localhost",
        }) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    const delivery = await sendDailyCheckInReminderEmail({
      to: patient.email,
    });

    if (delivery.ok) {
      await prisma.reminderOutbox.update({
        where: { id: reminderRecord.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          providerMessageId: delivery.providerMessageId,
        },
      });

      summary.sent += 1;
      continue;
    }

    await prisma.reminderOutbox.update({
      where: { id: reminderRecord.id },
      data: {
        status: ReminderStatus.FAILED,
        failedAt: new Date(),
      },
    });

    summary.failed += 1;
  }

  return summary;
}
