export interface RecoveryLogDetails {
  bleedingLevel: string;
  drainageLevel: string;
  rednessLevel: string;
  warmth: boolean;
  odor: boolean;
  temperatureF: string;
  nausea: boolean;
  dizziness: boolean;
  shortnessOfBreath: boolean;
  chestPain: boolean;
  steps: string;
  mobility: string;
  sleepHours: string;
  waterCups: string;
  meals: string;
  medsTaken: string[];
  missedMeds: boolean;
  medicationSideEffects: string;
  redFlags: string[];
}

export interface RecoveryLogEntry {
  id?: string;
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
  schemaVersion: number;
  details: RecoveryLogDetails;
  createdAt?: string;
  updatedAt?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning";
  targetRoute: string;
}

export function createEmptyLogDetails(): RecoveryLogDetails {
  return {
    bleedingLevel: "none",
    drainageLevel: "none",
    rednessLevel: "none",
    warmth: false,
    odor: false,
    temperatureF: "",
    nausea: false,
    dizziness: false,
    shortnessOfBreath: false,
    chestPain: false,
    steps: "",
    mobility: "normal",
    sleepHours: "",
    waterCups: "",
    meals: "",
    medsTaken: [],
    missedMeds: false,
    medicationSideEffects: "",
    redFlags: [],
  };
}

export function normalizeLogEntry(entry: Partial<RecoveryLogEntry> & Pick<RecoveryLogEntry, "date">): RecoveryLogEntry {
  return {
    date: entry.date,
    painLevel: entry.painLevel ?? 5,
    swellingLevel: entry.swellingLevel ?? 5,
    notes: entry.notes ?? "",
    schemaVersion: 2,
    details: {
      ...createEmptyLogDetails(),
      ...(entry.details ?? {}),
      medsTaken: Array.isArray(entry.details?.medsTaken) ? entry.details.medsTaken : [],
      redFlags: Array.isArray(entry.details?.redFlags) ? entry.details.redFlags : [],
    },
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
