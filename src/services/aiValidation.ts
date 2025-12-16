export type RiskAssessment = 'low' | 'medium' | 'high' | 'critical';

export type AdvancedDetails = {
  executiveSummary?: string;
  likelyDrivers?: string[];
  safetyFlags?: string[];
  actionPlan7Days?: string[];
  experiments?: string[];
  questionsForClinician?: string[];
  dataQualityNotes?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asStringArray = (value: unknown, maxItems = 20): string[] => {
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

export const asNumber = (value: unknown, fallback: number, min?: number, max?: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
};

export const asRiskAssessment = (value: unknown, fallback: RiskAssessment = 'medium'): RiskAssessment => {
  const v = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'critical') return v;
  return fallback;
};

export const normalizeDetails = (value: unknown): AdvancedDetails | null => {
  if (!isRecord(value)) return null;

  const details: AdvancedDetails = {
    executiveSummary: typeof value.executiveSummary === 'string' ? value.executiveSummary : undefined,
    likelyDrivers: asStringArray(value.likelyDrivers, 12),
    safetyFlags: asStringArray(value.safetyFlags, 10),
    actionPlan7Days: asStringArray(value.actionPlan7Days, 12),
    experiments: asStringArray(value.experiments, 10),
    questionsForClinician: asStringArray(value.questionsForClinician, 12),
    dataQualityNotes: asStringArray(value.dataQualityNotes, 12),
  };

  // If it ended up empty, return null to avoid noisy UI.
  const hasAny = Object.values(details).some(v => (Array.isArray(v) ? v.length > 0 : !!v));
  return hasAny ? details : null;
};
