import OpenAI from 'openai';

// Centralized AI Model Configuration
// Model: GPT-5.4-mini for all AI assistants & agents
export const AI_CONFIG = {
  defaultModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  fallbackModel: 'gpt-5.4-mini',
  whisperModel: 'whisper-1',
  ttsModel: 'tts-1',
  ttsVoice: 'nova' as const, // 'nova' (calm voice) | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer'
  temperature: 1.0,
  maxTokens: 2048,
};

// Singleton Server-side OpenAI Client instance
let openaiClientInstance: OpenAI | null = null;

export const getOpenAIClient = (): OpenAI => {
  if (!openaiClientInstance) {
    let apiKey = process.env.OPENAI_API_KEY || '';
    // Sanitize any wrapping quotes or accidental whitespace from .env
    apiKey = apiKey.replace(/^["']|["']$/g, '').trim();
    if (!apiKey) {
      console.warn('Warning: OPENAI_API_KEY is not set in environment variables.');
    }
    openaiClientInstance = new OpenAI({
      apiKey: apiKey || 'dummy-key-for-build',
    });
  }
  return openaiClientInstance;
};
