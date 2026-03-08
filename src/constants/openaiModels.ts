export type AIProvider = 'openai' | 'google' | 'anthropic' | 'deepseek';
export type AIModelCategory =
  | 'latest'
  | 'reasoning'
  | 'chat'
  | 'legacy'
  | 'gemini'
  | 'claude'
  | 'deepseek';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  /** USD per 1,000,000 tokens. Null means unknown / not configured. */
  inputCostPer1M: number | null;
  /** USD per 1,000,000 tokens. Null means unknown / not configured. */
  outputCostPer1M: number | null;
  maxTokens: number;
  category: AIModelCategory;
  provider: AIProvider;
  isRecommended?: boolean;
  pricingUrl?: string;
  pricingAsOf?: string;
}

// Legacy interface for backwards compatibility
export interface OpenAIModel extends AIModel {
  provider: 'openai';
}

export const OPENAI_MODELS: AIModel[] = [
  // OpenAI (pricing source: https://developers.openai.com/api/docs/pricing)
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: 'Newest flagship GPT model for top-quality reasoning and coding',
    inputCostPer1M: 2.5,
    outputCostPer1M: 15.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    isRecommended: true,
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    description: 'Highest-quality GPT-5.4 tier for maximum precision',
    inputCostPer1M: 30.0,
    outputCostPer1M: 180.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Strong all-round GPT-5 generation model',
    inputCostPer1M: 1.75,
    outputCostPer1M: 14.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'Previous GPT-5 generation with strong quality/cost balance',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: 'Fast, cost-effective GPT-5 tier for well-defined tasks',
    inputCostPer1M: 0.25,
    outputCostPer1M: 2.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    isRecommended: true,
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    description: 'Smallest GPT-5 tier for minimal token cost',
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.4,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    description: 'Premium GPT-5.2 tier (higher quality, much higher cost)',
    inputCostPer1M: 21.0,
    outputCostPer1M: 168.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },

  // OpenAI legacy / older families
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Older flagship model family with broad compatibility',
    inputCostPer1M: 2.0,
    outputCostPer1M: 8.0,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 mini',
    description: 'Lower-cost legacy GPT-4.1 variant',
    inputCostPer1M: 0.4,
    outputCostPer1M: 1.6,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 nano',
    description: 'Oldest actively priced GPT-4.1 tier in this app catalog',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Legacy multimodal model (widely supported)',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'Legacy low-cost GPT-4o variant',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    maxTokens: 16384,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (Legacy)',
    description: 'Old legacy model, kept for compatibility and low-cost use',
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
    maxTokens: 4096,
    category: 'legacy',
    provider: 'openai',
    pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },

  // Google Gemini (pricing source: https://ai.google.dev/gemini-api/docs/pricing)
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    description: 'Newest top Gemini model family for advanced reasoning and coding',
    inputCostPer1M: 2.0,
    outputCostPer1M: 12.0,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Newest fast Gemini 3 model for speed + quality',
    inputCostPer1M: 0.5,
    outputCostPer1M: 3.0,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash-Lite (Preview)',
    description: 'Newest low-cost Gemini model for high-throughput workloads',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.5,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'State-of-the-art multipurpose model (coding + complex reasoning)',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    isRecommended: true,
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Hybrid reasoning model with thinking budgets (balanced)',
    inputCostPer1M: 0.3,
    outputCostPer1M: 2.5,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    isRecommended: true,
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Smallest / most cost-effective Gemini model for scale',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    isRecommended: true,
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Balanced multimodal model (1M context)',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Smallest / most cost-effective Gemini model (legacy tier)',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2026-03-08'
  },

  // Anthropic Claude (pricing source: https://platform.claude.com/docs/en/about-claude/pricing)
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Newest top-tier Claude model for high-complexity tasks',
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    maxTokens: 128000,
    category: 'claude',
    provider: 'anthropic',
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Newest balanced Claude model for agents and coding',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxTokens: 64000,
    category: 'claude',
    provider: 'anthropic',
    isRecommended: true,
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Best balance for complex agents and coding',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxTokens: 200000,
    category: 'claude',
    provider: 'anthropic',
    isRecommended: true,
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Fastest Claude model with near-frontier intelligence',
    inputCostPer1M: 1.0,
    outputCostPer1M: 5.0,
    maxTokens: 200000,
    category: 'claude',
    provider: 'anthropic',
    isRecommended: true,
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    description: 'Older Claude model with lower costs for simple workloads',
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    maxTokens: 200000,
    category: 'claude',
    provider: 'anthropic',
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'claude-haiku-3',
    name: 'Claude Haiku 3 (Legacy)',
    description: 'Oldest low-cost Claude model in this catalog',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    maxTokens: 200000,
    category: 'claude',
    provider: 'anthropic',
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    pricingAsOf: '2026-03-08'
  },

  // DeepSeek (pricing source: https://api-docs.deepseek.com/quick_start/pricing)
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'DeepSeek-V3.2 (Non-thinking mode)',
    // DeepSeek input pricing is split into cache-hit vs cache-miss.
    // This app does not use prompt caching, so cache-miss is the effective price.
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    maxTokens: 8000,
    category: 'deepseek',
    provider: 'deepseek',
    pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    pricingAsOf: '2026-03-08'
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    description: 'DeepSeek-V3.2 (Thinking mode)',
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    maxTokens: 64000,
    category: 'deepseek',
    provider: 'deepseek',
    pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    pricingAsOf: '2026-03-08'
  }
];

export const getModelsByCategory = (category: string) => {
  return OPENAI_MODELS.filter(model => model.category === category);
};

export const getModelsByProvider = (provider: AIProvider) => {
  return OPENAI_MODELS.filter(model => model.provider === provider);
};

export const getRecommendedModels = () => {
  return OPENAI_MODELS.filter(model => model.isRecommended);
};

export const getModelById = (id: string) => {
  return OPENAI_MODELS.find(model => model.id === id);
};

export const getLatestPricingAsOf = (): string | null => {
  const validDates = OPENAI_MODELS
    .map(model => model.pricingAsOf)
    .filter((date): date is string => !!date)
    .map(date => ({ raw: date, ms: Date.parse(date) }))
    .filter(item => !Number.isNaN(item.ms))
    .sort((a, b) => b.ms - a.ms);

  return validDates[0]?.raw ?? null;
};

export const getPricingAgeDays = (pricingAsOf: string | null): number | null => {
  if (!pricingAsOf) return null;
  const ms = Date.parse(pricingAsOf);
  if (Number.isNaN(ms)) return null;

  const ageMs = Date.now() - ms;
  return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
};

export const getCheapestEstimatedModel = (
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): AIModel | null => {
  const priced = OPENAI_MODELS.filter(
    model => model.inputCostPer1M != null && model.outputCostPer1M != null
  );

  if (priced.length === 0) return null;

  let cheapest: AIModel | null = null;
  let cheapestCost = Number.POSITIVE_INFINITY;

  for (const model of priced) {
    const cost = calculateEstimatedCost(model, estimatedInputTokens, estimatedOutputTokens);
    if (cost != null && cost < cheapestCost) {
      cheapestCost = cost;
      cheapest = model;
    }
  }

  return cheapest;
};

export const getCheapestEstimatedModelByProvider = (
  provider: AIProvider,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): AIModel | null => {
  const models = getModelsByProvider(provider).filter(
    model => model.inputCostPer1M != null && model.outputCostPer1M != null
  );

  if (models.length === 0) return null;

  let cheapest: AIModel | null = null;
  let cheapestCost = Number.POSITIVE_INFINITY;

  for (const model of models) {
    const cost = calculateEstimatedCost(model, estimatedInputTokens, estimatedOutputTokens);
    if (cost != null && cost < cheapestCost) {
      cheapestCost = cost;
      cheapest = model;
    }
  }

  return cheapest;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
};

export const calculateCostFromTokenUsage = (
  modelOrId: AIModel | string,
  usage: TokenUsage
): number | null => {
  const model = typeof modelOrId === 'string' ? getModelById(modelOrId) : modelOrId;
  if (!model) return null;
  if (model.inputCostPer1M == null || model.outputCostPer1M == null) return null;

  const inputCost = (usage.inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
};

export const calculateEstimatedCost = (
  model: AIModel, 
  estimatedInputTokens: number = 1000, 
  estimatedOutputTokens: number = 500
): number | null => {
  if (model.inputCostPer1M == null || model.outputCostPer1M == null) {
    return null;
  }
  const inputCost = (estimatedInputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (estimatedOutputTokens / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
};

export const formatCostEstimate = (cost: number | null): string => {
  if (cost == null || Number.isNaN(cost)) return '—';
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(1)}‰`; // per mille symbol for very small costs
  } else if (cost < 0.01) {
    return `$${(cost * 100).toFixed(1)}¢`;
  } else if (cost < 1.00) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
};

// Default models for new users
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const DEFAULT_MODEL = DEFAULT_OPENAI_MODEL;

// Estimated tokens for diabetes analysis (realistic estimates)
export const DIABETES_ANALYSIS_TOKENS = {
  input: 250,   // Glucose data summary + prompt (realistic for typical analysis)
  output: 150   // Concise analysis response (typical for medical insights)
};
