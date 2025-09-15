export interface AIModel {
  id: string;
  name: string;
  description: string;
  inputCostPer1k: number;  // Cost per 1K input tokens in USD
  outputCostPer1k: number; // Cost per 1K output tokens in USD
  maxTokens: number;
  category: 'latest' | 'reasoning' | 'chat' | 'legacy' | 'gemini';
  provider: 'openai' | 'google';
  isRecommended?: boolean;
}

// Legacy interface for backwards compatibility
export interface OpenAIModel extends AIModel {
  provider: 'openai';
}

export const OPENAI_MODELS: AIModel[] = [
  // Latest Models (GPT-4o family)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Latest flagship model with improved reasoning and vision capabilities',
    inputCostPer1k: 5.00,
    outputCostPer1k: 15.00,
    maxTokens: 4096,
    category: 'latest',
    provider: 'openai',
    isRecommended: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'Affordable and intelligent small model for fast, lightweight tasks',
    inputCostPer1k: 0.150,
    outputCostPer1k: 0.600,
    maxTokens: 16384,
    category: 'latest',
    provider: 'openai',
    isRecommended: true
  },
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o (2024-11-20)',
    description: 'Latest GPT-4o version with enhanced capabilities',
    inputCostPer1k: 5.00,
    outputCostPer1k: 15.00,
    maxTokens: 4096,
    category: 'latest',
    provider: 'openai'
  },
  {
    id: 'gpt-4o-2024-08-06',
    name: 'GPT-4o (2024-08-06)',
    description: 'GPT-4o with structured outputs support',
    inputCostPer1k: 5.00,
    outputCostPer1k: 15.00,
    maxTokens: 4096,
    category: 'latest',
    provider: 'openai'
  },
  {
    id: 'gpt-4o-2024-05-13',
    name: 'GPT-4o (2024-05-13)',
    description: 'Original GPT-4o release with multimodal capabilities',
    inputCostPer1k: 5.00,
    outputCostPer1k: 15.00,
    maxTokens: 4096,
    category: 'latest',
    provider: 'openai'
  },
  {
    id: 'gpt-4o-mini-2024-07-18',
    name: 'GPT-4o mini (2024-07-18)',
    description: 'Specific version of GPT-4o mini',
    inputCostPer1k: 0.150,
    outputCostPer1k: 0.600,
    maxTokens: 16384,
    category: 'latest',
    provider: 'openai'
  },

  // ChatGPT-5 Models (o1 Reasoning family)
  {
    id: 'chatgpt-5',
    name: 'ChatGPT-5',
    description: 'Next-generation AI model with advanced reasoning capabilities',
    inputCostPer1k: 15.00,
    outputCostPer1k: 60.00,
    maxTokens: 32768,
    category: 'reasoning',
    provider: 'openai'
  },
  {
    id: 'o1',
    name: 'ChatGPT-5 (o1)',
    description: 'Most capable reasoning model for complex, multi-step problems',
    inputCostPer1k: 15.00,
    outputCostPer1k: 60.00,
    maxTokens: 32768,
    category: 'reasoning',
    provider: 'openai'
  },
  {
    id: 'o1-preview',
    name: 'ChatGPT-5 Preview (o1-preview)',
    description: 'Preview of ChatGPT-5 reasoning model with advanced problem-solving',
    inputCostPer1k: 15.00,
    outputCostPer1k: 60.00,
    maxTokens: 32768,
    category: 'reasoning',
    provider: 'openai'
  },
  {
    id: 'o1-preview-2024-09-12',
    name: 'o1-preview (2024-09-12)',
    description: 'Specific version of ChatGPT-5 preview reasoning model',
    inputCostPer1k: 15.00,
    outputCostPer1k: 60.00,
    maxTokens: 32768,
    category: 'reasoning',
    provider: 'openai'
  },
  {
    id: 'o1-mini',
    name: 'ChatGPT-5 mini (o1-mini)',
    description: 'Faster, more affordable ChatGPT-5 model for STEM tasks',
    inputCostPer1k: 3.00,
    outputCostPer1k: 12.00,
    maxTokens: 65536,
    category: 'reasoning',
    provider: 'openai'
  },
  {
    id: 'o1-mini-2024-09-12',
    name: 'o1-mini (2024-09-12)',
    description: 'Specific version of ChatGPT-5 mini reasoning model',
    inputCostPer1k: 3.00,
    outputCostPer1k: 12.00,
    maxTokens: 65536,
    category: 'reasoning',
    provider: 'openai'
  },

  // Chat Models (GPT-4 family)
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High-performance model with 128K context window',
    inputCostPer1k: 10.00,
    outputCostPer1k: 30.00,
    maxTokens: 4096,
    category: 'chat',
    provider: 'openai'
  },
  {
    id: 'gpt-4-turbo-2024-04-09',
    name: 'GPT-4 Turbo (2024-04-09)',
    description: 'Specific version of GPT-4 Turbo with vision capabilities',
    inputCostPer1k: 10.00,
    outputCostPer1k: 30.00,
    maxTokens: 4096,
    category: 'chat',
    provider: 'openai'
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Original GPT-4 model with strong reasoning capabilities',
    inputCostPer1k: 30.00,
    outputCostPer1k: 60.00,
    maxTokens: 8192,
    category: 'chat',
    provider: 'openai'
  },
  {
    id: 'gpt-4-0613',
    name: 'GPT-4 (0613)',
    description: 'June 2023 version of GPT-4',
    inputCostPer1k: 30.00,
    outputCostPer1k: 60.00,
    maxTokens: 8192,
    category: 'legacy',
    provider: 'openai'
  },

  // Legacy Models (GPT-3.5 family)
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and affordable model for simple tasks',
    inputCostPer1k: 1.50,
    outputCostPer1k: 2.00,
    maxTokens: 4096,
    category: 'legacy',
    provider: 'openai'
  },
  {
    id: 'gpt-3.5-turbo-0125',
    name: 'GPT-3.5 Turbo (0125)',
    description: 'Updated GPT-3.5 Turbo with improved accuracy',
    inputCostPer1k: 0.50,
    outputCostPer1k: 1.50,
    maxTokens: 4096,
    category: 'legacy',
    provider: 'openai'
  },
  {
    id: 'gpt-3.5-turbo-1106',
    name: 'GPT-3.5 Turbo (1106)',
    description: 'November 2023 version of GPT-3.5 Turbo',
    inputCostPer1k: 1.00,
    outputCostPer1k: 2.00,
    maxTokens: 4096,
    category: 'legacy',
    provider: 'openai'
  },

  // Google Gemini Models
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    description: 'Latest experimental Gemini model with enhanced capabilities',
    inputCostPer1k: 0.075,  // $0.075 per 1M tokens
    outputCostPer1k: 0.30,  // $0.30 per 1M tokens
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google',
    isRecommended: true
  },
  {
    id: 'gemini-exp-1206',
    name: 'Gemini Experimental (1206)',
    description: 'Advanced experimental Gemini model with cutting-edge features',
    inputCostPer1k: 0.075,  // $0.075 per 1M tokens
    outputCostPer1k: 0.30,  // $0.30 per 1M tokens
    maxTokens: 2000000,
    category: 'gemini',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-pro-002',
    name: 'Gemini 1.5 Pro (Latest)',
    description: 'Latest stable version of Gemini Pro with improved performance',
    inputCostPer1k: 1.25,   // $1.25 per 1M tokens (updated pricing)
    outputCostPer1k: 5.00,  // $5.00 per 1M tokens
    maxTokens: 2000000,
    category: 'gemini',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-flash-002',
    name: 'Gemini 1.5 Flash (Latest)',
    description: 'Latest stable version of Gemini Flash - fast and efficient',
    inputCostPer1k: 0.075,  // $0.075 per 1M tokens
    outputCostPer1k: 0.30,  // $0.30 per 1M tokens
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    description: 'Smaller, ultra-fast model for simple tasks',
    inputCostPer1k: 0.0375, // $0.0375 per 1M tokens
    outputCostPer1k: 0.15,  // $0.15 per 1M tokens
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (Legacy)',
    description: 'Previous version of Gemini Pro for compatibility',
    inputCostPer1k: 3.50,   // $3.50 per 1M tokens
    outputCostPer1k: 10.50, // $10.50 per 1M tokens
    maxTokens: 2000000,
    category: 'gemini',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (Legacy)',
    description: 'Previous version of Gemini Flash for compatibility',
    inputCostPer1k: 0.075,  // $0.075 per 1M tokens
    outputCostPer1k: 0.30,  // $0.30 per 1M tokens
    maxTokens: 1000000,
    category: 'gemini',
    provider: 'google'
  }
];

export const getModelsByCategory = (category: string) => {
  return OPENAI_MODELS.filter(model => model.category === category);
};

export const getModelsByProvider = (provider: 'openai' | 'google') => {
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
): number => {
  const inputCost = (estimatedInputTokens / 1000) * model.inputCostPer1k;
  const outputCost = (estimatedOutputTokens / 1000) * model.outputCostPer1k;
  return inputCost + outputCost;
};

export const formatCostEstimate = (cost: number): string => {
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
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-exp';
export const DEFAULT_MODEL = DEFAULT_OPENAI_MODEL;

// Estimated tokens for diabetes analysis (realistic estimates)
export const DIABETES_ANALYSIS_TOKENS = {
  input: 250,   // Glucose data summary + prompt (realistic for typical analysis)
  output: 150   // Concise analysis response (typical for medical insights)
};
