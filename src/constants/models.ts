export interface ModelMetadata {
  id: string;
  name: string;
  power: string;   // IQ Rank
  usage: string;   // Best use case
  cost: string;    // Paid vs Free
  isVision?: boolean;
}

export const MODEL_REGISTRY: ModelMetadata[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    power: '💎 Elite (100)',
    usage: 'Complex Logic / Master Coding',
    cost: 'Premium tokens',
    isVision: true
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    power: '💎 Elite (98)',
    usage: 'Balanced reasoning & Speed',
    cost: 'Premium tokens',
    isVision: true
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    power: '🧠 High Intelligence',
    usage: 'Massive Context / Long Interviews',
    cost: 'Fast tokens',
    isVision: true
  },

  {
    id: 'meta-llama/llama-3.1-405b',
    name: 'Llama 3.1 405B',
    power: '💎 Elite (Open)',
    usage: 'State-of-the-art Open Weights',
    cost: 'Premium tokens',
    isVision: true
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B (Free)',
    power: '⚡ Basic Speed',
    usage: 'General Technical QA',
    cost: 'FREE (Unlimited)',
    isVision: false
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B (Free)',
    power: '⚡ Basic Speed',
    usage: 'Casual / Testing',
    cost: 'FREE (Unlimited)',
    isVision: false
  }
];
