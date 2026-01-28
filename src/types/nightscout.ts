export type NightscoutApiVersion = 'v1' | 'v3';

export interface NightscoutEntry {
  _id?: string;
  id?: string;

  // Normalized: epoch-ms
  date: number;
  mills: number;

  sgv: number;
  direction?: string;
  type?: string;
  device?: string;
  dateString?: string;
}

export interface NightscoutTreatment {
  _id?: string;
  id?: string;

  eventType?: string;
  enteredBy?: string;

  // Normalized: always present when parsed
  created_at: string;
  timestamp?: string;
  date?: number;

  // Normalized: epoch-ms
  mills: number;

  // Common treatment fields used across the app
  insulin?: number;
  units?: number;
  carbs?: number;
  duration?: number;

  notes?: string;
  reason?: string;

  // OpenAPS/Loop related
  absolute?: number;
  rate?: number;
  temp?: string;

  protein?: number;
  fat?: number;

  glucose?: number;
  glucoseType?: string;
  bg?: number;

  // Frequently present on some uploaders/integrations
  iob?: number | null;
  cob?: number | null;
  eventualBG?: number | null;

  battery?: number | null;
  reservoir?: number | null;
  suspended?: boolean | null;
  bolusing?: boolean | null;
  tempBasal?: {
    rate?: number;
    duration?: number;
    timestamp?: string;
  } | null;
}

export interface NightscoutProfile {
  _id?: string;
  id?: string;

  startDate?: string;
  defaultProfile?: string;
  // Profile content is highly dynamic (basal/sens/carb ratios etc.)
  store?: Record<string, unknown>;

  units?: string;
  dia?: number;
}

export interface NightscoutDeviceStatus {
  _id?: string;
  id?: string;

  created_at?: string;

  // Normalized: epoch-ms
  date?: number;
  mills?: number;

  // Device status payloads vary widely by uploader (AAPS, Loop, OpenAPS, pump integrations)
  pump?: Record<string, unknown>;
  openaps?: Record<string, unknown>;
  loop?: Record<string, unknown>;
  AAPS?: Record<string, unknown>;
  uploader?: Record<string, unknown>;

  // Common convenience fields seen on some setups
  iob?: number | null;
  cage?: number | null;
  sage?: number | null;
  basal?: number | null;
}

export interface NightscoutFetchResult {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  profile: NightscoutProfile[];
  deviceStatus: NightscoutDeviceStatus[];
  detectedApiVersion: NightscoutApiVersion;
}
