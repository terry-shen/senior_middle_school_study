/**
 * LLM Types and Interfaces
 */

export type LLMProvider = 'ollama' | 'zhipu' | 'qwen' | 'openai';

export interface LLMConfig {
  id: number;
  name: string;
  provider: LLMProvider;
  endpoint: string;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
  status: 'active' | 'inactive';
  maxTokens?: number;
  temperature?: number;
}

export interface LLMRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  cached?: boolean;
}

export interface ModelInfo {
  name: string;
  size?: string;
  modifiedAt?: string;
  digest?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  models?: ModelInfo[];
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  backoffMultiplier: number;
  fallbackEnabled: boolean;
}

export interface LLMServiceConfig {
  retry?: Partial<RetryConfig>;
  cacheEnabled?: boolean;
  cacheTTL?: number; // Time-to-live in seconds
}

export interface CacheEntry {
  requestHash: string;
  response: LLMResponse;
  modelId: number;
  createdAt: Date;
  expiresAt: Date;
}