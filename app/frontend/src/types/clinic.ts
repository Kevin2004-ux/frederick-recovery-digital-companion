import type { RecoveryLogEntry } from "@/types/log";

export interface ClinicBatch {
  id: string;
  clinicTag: string | null;
  quantity: number;
  boxType: string | null;
  includedItems: Array<{ key?: string; label: string }>;
  createdAt: string;
  codeCounts?: {
    total: number;
    unused: number;
    claimed: number;
    configured: number;
    quantityMismatch: boolean;
  };
}

export interface ClinicBatchCode {
  code: string;
  status: string;
  clinicTag: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
}

export interface ClinicPatientRosterItem {
  patientId: string | null;
  displayName: string | null;
  activationCode: string;
  recoveryStartDate: string | null;
  currentRecoveryDay: number | null;
  simpleStatus: string | null;
  statusReasons: string[];
  primaryStatusReason: string | null;
  primaryStatusReasonLabel: string | null;
  lastCheckInDate: string | null;
  lastPainLevel: number | null;
  lastSwellingLevel: number | null;
  hasRecentCheckIn: boolean;
  unresolvedAlertCount: number;
  highestOpenAlertSeverity: string | null;
  topOpenAlert: {
    severity: string;
    type: string;
    summary: string;
    lastTriggeredAt: string;
  } | null;
}

export interface ClinicPatientSummary {
  patient: {
    patientId: string;
    displayName: string;
    email: string;
  };
  activation: {
    activationCode: string;
    status: string;
    claimedAt: string | null;
    clinicTag: string | null;
  };
  recovery: {
    recoveryStartDate: string | null;
    currentRecoveryDay: number | null;
    simpleStatus: string | null;
    statusReasons: string[];
  };
  latestCheckIn: RecoveryLogEntry | null;
  recentCheckIns: RecoveryLogEntry[];
  recentPainTrend: string;
  recentSwellingTrend: string;
  myBox: {
    batchId: string;
    boxType: string | null;
    includedItems: Array<{ key: string; label: string }>;
  } | null;
  openAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    reasons: string[];
    summary: string | null;
    triggeredAt: string;
    resolvedAt: string | null;
  }>;
}

export interface PlanConfig {
  recovery_region: "leg_foot" | "arm_hand" | "torso" | "face_neck" | "general";
  recovery_duration: "standard_0_7" | "standard_8_14" | "standard_15_21" | "extended_22_plus";
  mobility_impact: "none" | "mild" | "limited" | "non_weight_bearing";
  incision_status: "intact_dressings" | "sutures_staples" | "drains_present" | "open_wound" | "none_visible";
  discomfort_pattern: "expected_soreness" | "sharp_intermittent" | "burning_tingling" | "escalating";
  follow_up_expectation: "within_7_days" | "within_14_days" | "within_30_days" | "none_scheduled";
}

export const defaultPlanConfig: PlanConfig = {
  recovery_region: "general",
  recovery_duration: "standard_0_7",
  mobility_impact: "mild",
  incision_status: "intact_dressings",
  discomfort_pattern: "expected_soreness",
  follow_up_expectation: "within_14_days",
};
