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
  education?: {
    title?: string;
    summary?: string;
    instructions?: string | string[];
    warnings?: string | string[];
  };
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

export type IncludedItemRef =
  | string
  | {
      key?: string | null;
      label?: string | null;
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
    includedItems?: IncludedItemRef[];
  } | null;
  openAlerts?: OperationalAlert[];
};

export type RecoveryLibraryCategoryKey =
  | "start-here"
  | "common-recovery-topics"
  | "procedure-guides"
  | "box-item-instructions"
  | "videos"
  | "clinic-instructions";

export type RecoveryLibraryGuideSummary = {
  id: string;
  title: string;
  type: "education" | "task" | "milestone";
  summary: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  categories: RecoveryLibraryCategoryKey[];
  procedureNames: string[];
  boxItemKeys: string[];
  recommended: boolean;
  featured: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  displayOrder: number;
  requiredBoxItems: string[];
  frequency?: string | null;
};

export type RecoveryLibraryCategory = {
  key: RecoveryLibraryCategoryKey;
  title: string;
  description: string;
  moduleCount: number;
  featuredGuides: RecoveryLibraryGuideSummary[];
};

export type RecoveryLibraryProductMode = "kit_only" | "full_platform";

export type RecoveryLibraryAssignmentSummary = {
  activationCode: string | null;
  productMode: RecoveryLibraryProductMode;
  educationBundle: {
    id: string;
    name: string;
    slug: string;
    procedureName: string | null;
  } | null;
  boxTemplate: {
    id: string;
    name: string;
    slug: string;
  } | null;
  hasCodeEducationOverrides: boolean;
  hasCodeBoxItemOverrides: boolean;
};

export type RecoveryLibraryHomePayload = {
  recommendedGuides: RecoveryLibraryGuideSummary[];
  categories: RecoveryLibraryCategory[];
  sections: Record<RecoveryLibraryCategoryKey, RecoveryLibraryGuideSummary[]>;
  personalized: {
    productMode: RecoveryLibraryProductMode;
    assignment: RecoveryLibraryAssignmentSummary | null;
    procedureName: string | null;
    boxItems: Array<{ key: string | null; label: string }>;
    procedureGuides: RecoveryLibraryGuideSummary[];
    boxItemGuides: RecoveryLibraryGuideSummary[];
  };
};

export type RecoveryLibraryGuide = {
  id: string;
  type: "education" | "task" | "milestone";
  title: string;
  text: string;
  summary: string;
  paragraphs: string[];
  keyPoints: string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  frequency?: string | null;
  redFlags: string[];
  requiredBoxItems: string[];
  categories: RecoveryLibraryCategoryKey[];
  procedureNames: string[];
  boxItemKeys: string[];
  recommended: boolean;
  featured: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  active: boolean;
  displayOrder: number;
  source: "content_library" | "custom";
  isCustomized: boolean;
};

export type RecoveryLibraryGuidePayload = {
  guide: RecoveryLibraryGuide;
  relatedGuides: RecoveryLibraryGuideSummary[];
};

export type RecoveryLibraryCategoryPayload = {
  category: Omit<RecoveryLibraryCategory, "moduleCount" | "featuredGuides">;
  guides: RecoveryLibraryGuideSummary[];
};
