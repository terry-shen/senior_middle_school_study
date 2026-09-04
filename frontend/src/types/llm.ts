/**
 * LLM Types for Frontend
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
  createdAt?: string;
  updatedAt?: string;
}

export interface LLMConfigFormData {
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

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  models?: Array<{
    name: string;
    size?: string;
    modifiedAt?: string;
  }>;
}

export interface CallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatency: number;
  totalTokens: number;
  successRate: number;
}