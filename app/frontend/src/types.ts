export type DailyLogDetails = {
  painCompared?: "Better" | "Same" | "Worse" | "";
  swellingToday?: "None" | "Mild" | "Moderate" | "Severe" | "";
  swellingCompared?: "Better" | "Same" | "Worse" | "";
  movedAsRecommended?: "Yes" | "Somewhat" | "No" | "";
  difficultyActivities?: "None" | "Mild" | "Significant" | "";
  tookMeds?: "Yes" | "Missed one" | "Missed multiple" | "";
  sideEffects?: string[];
  sideEffectsOtherText?: string;
  nonMedRelief?: string[];
  siteChange?: "No" | "Slight" | "Significant" | "";
  drainage?: "None" | "Clear" | "Bloody" | "Yellow-green" | "";
  redFlags?: string[];
  sleepHours?: string;
  sleepQuality?: "Poor" | "Fair" | "Good" | "Excellent" | "";
  eatNormally?: "Yes" | "Somewhat" | "No" | "";
  fluidIntake?: "Low" | "Adequate" | "High" | "";
  mood?: "Positive" | "Neutral" | "Low" | "";
  anxiety?: "Not at all" | "Somewhat" | "Very" | "";
  notes?: string;
  [key: string]: unknown;
};

export type DailyLogEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
  schemaVersion?: number;
  details?: DailyLogDetails | Record<string, unknown> | null;
};

export type PatientProfile = {
  patientId?: string | null;
  displayName?: string | null;
  email?: string | null;
  procedureName?: string | null;
  recoveryStartDate?: string | null;
  consentAcceptedAt?: string | null;
};

export type BoxItem = {
  key: string;
  label: string;
  description?: string;
  education?: string;
  educationUrl?: string;
};

export type MyBoxPayload = {
  myBox: {
    batchId?: string;
    boxType?: string | null;
    includedItems?: Array<{ key: string; label: string }>;
    items?: BoxItem[];
  } | null;
  source?: {
    type?: string;
    derivedFromClaimedActivation?: boolean;
    activationStatus?: string | null;
    batchLinked?: boolean;
    itemEducationSource?: string | null;
  };
};

export type ClinicPatientRow = {
  patientId?: string | null;
  displayName?: string | null;
  email?: string | null;
  activationCode?: string | null;
  recoveryStartDate?: string | null;
  currentRecoveryDay?: number | null;
  simpleStatus?: string | null;
  statusReasons?: string[];
  primaryStatusReason?: string | null;
  primaryStatusReasonLabel?: string | null;
  lastCheckInDate?: string | null;
  lastPainLevel?: number | null;
  lastSwellingLevel?: number | null;
  hasRecentCheckIn?: boolean;
  unresolvedAlertCount?: number;
  highestOpenAlertSeverity?: string | null;
  topOpenAlert?: string | null;
  id?: string | null;
  code?: string | null;
  joinedAt?: string | Date | null;
  startDate?: string | null;
};

export type OperationalAlert = {
  id: string;
  patientUserId?: string;
  clinicTag?: string;
  type: string;
  severity: string;
  status?: string;
  reasons?: string[];
  summary?: string | null;
  triggeredAt?: string | Date;
  resolvedAt?: string | Date | null;
};

export type ClinicPatientSummary = {
  patient?: PatientProfile;
  activation?: {
    activationCode?: string;
    status?: string;
    claimedAt?: string | Date | null;
    clinicTag?: string | null;
  };
  recovery?: {
    recoveryStartDate?: string | null;
    currentRecoveryDay?: number | null;
    simpleStatus?: string | null;
    statusReasons?: string[];
  };
  latestCheckIn?: DailyLogEntry | null;
  recentCheckIns?: DailyLogEntry[];
  recentPainTrend?: string | null;
  recentSwellingTrend?: string | null;
  myBox?: {
    batchId?: string;
    boxType?: string | null;
    includedItems?: string[];
  } | null;
  openAlerts?: OperationalAlert[];
};
