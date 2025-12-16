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
  // OpenAI (pricing source: https://openai.com/api/pricing/)
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Flagship model for coding and agentic tasks',
    inputCostPer1M: 1.75,
    outputCostPer1M: 14.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    isRecommended: true,
    pricingUrl: 'https://openai.com/api/pricing/',
    pricingAsOf: '2025-12-16'
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 pro',
    description: 'Highest-precision model (premium)',
    inputCostPer1M: 21.0,
    outputCostPer1M: 168.0,
    maxTokens: 8192,
    category: 'latest',
    provider: 'openai',
    pricingUrl: 'https://openai.com/api/pricing/',
    pricingAsOf: '2025-12-16'
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
    pricingUrl: 'https://openai.com/api/pricing/',
    pricingAsOf: '2025-12-16'
  },

  // Backwards-compat / legacy OpenAI IDs (pricing not kept up-to-date here)
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini (legacy id)',
    description: 'Legacy model id kept for compatibility (pricing may have changed)',
    inputCostPer1M: null,
    outputCostPer1M: null,
    maxTokens: 16384,
    category: 'legacy',
    provider: 'openai'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (legacy id)',
    description: 'Legacy model id kept for compatibility (pricing may have changed)',
    inputCostPer1M: null,
    outputCostPer1M: null,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai'
  },

  // Google Gemini (pricing source: https://ai.google.dev/gemini-api/docs/pricing)
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Most powerful Gemini model (preview)',
    inputCostPer1M: 2.0,
    outputCostPer1M: 12.0,
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    isRecommended: false,
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    pricingAsOf: '2025-12-16'
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
    pricingAsOf: '2025-12-16'
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
    pricingAsOf: '2025-12-16'
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
    pricingAsOf: '2025-12-16'
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
    pricingAsOf: '2025-12-16'
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
    pricingAsOf: '2025-12-16'
  },

  // Anthropic Claude (pricing source: https://platform.claude.com/docs/en/about-claude/models)
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
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/models',
    pricingAsOf: '2025-12-16'
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
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/models',
    pricingAsOf: '2025-12-16'
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    description: 'Premium Claude model (maximum intelligence)',
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    maxTokens: 200000,
    category: 'claude',
    provider: 'anthropic',
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/models',
    pricingAsOf: '2025-12-16'
  },

  // DeepSeek (pricing not publicly accessible without login at time of integration)
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'DeepSeek chat model (pricing not configured)',
    inputCostPer1M: null,
    outputCostPer1M: null,
    maxTokens: 8192,
    category: 'deepseek',
    provider: 'deepseek'
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    description: 'DeepSeek reasoning model (pricing not configured)',
    inputCostPer1M: null,
    outputCostPer1M: null,
    maxTokens: 8192,
    category: 'deepseek',
    provider: 'deepseek'
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
