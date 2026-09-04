/**
 * Base LLM Adapter Interface
 * All LLM adapters must implement this interface
 */

import { LLMRequest, LLMResponse, ConnectionTestResult, ModelInfo } from '../types/llm';

export interface LLMAdapter {
  /**
   * Test connection to the LLM service
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Get list of available models (if supported)
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * Generate completion
   */
  generate(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Generate chat completion (optional)
   */
  chat?(messages: Array<{ role: string; content: string }>, options?: Partial<LLMRequest>): Promise<LLMResponse>;

  /**
   * Check if model is available (optional)
   */
  isModelAvailable?(modelName?: string): Promise<boolean>;
}