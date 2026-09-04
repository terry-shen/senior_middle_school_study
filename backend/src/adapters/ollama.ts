/**
 * Ollama Adapter
 * Implements LLM operations for locally deployed Ollama models
 */

import axios, { AxiosInstance } from 'axios';
import { LLMConfig, LLMRequest, LLMResponse, ConnectionTestResult, ModelInfo, LLMProvider } from '../types/llm';

export class OllamaAdapter {
  private client: AxiosInstance;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/api/tags');
      const latency = Date.now() - startTime;
      
      const models: ModelInfo[] = response.data.models?.map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
      })) || [];

      return {
        success: true,
        latency,
        models,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed',
      };
    }
  }

  /**
   * Get list of available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models?.map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
      })) || [];
    } catch (error) {
      throw new Error('Failed to fetch models from Ollama');
    }
  }

  /**
   * Generate completion using Ollama API
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const ollamaRequest = {
        model: this.config.modelName,
        prompt: request.prompt,
        system: request.system,
        stream: false,
        options: {
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          num_predict: request.maxTokens ?? this.config.maxTokens ?? 4096,
          stop: request.stop,
        },
      };

      const response = await this.client.post('/api/generate', ollamaRequest);
      const latency = Date.now() - startTime;

      return {
        content: response.data.response,
        model: this.config.modelName,
        provider: 'ollama' as LLMProvider,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  /**
   * Generate chat completion using Ollama Chat API
   */
  async chat(messages: Array<{ role: string; content: string }>, options?: Partial<LLMRequest>): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const ollamaRequest = {
        model: this.config.modelName,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? this.config.maxTokens ?? 4096,
          stop: options?.stop,
        },
      };

      const response = await this.client.post('/api/chat', ollamaRequest);
      const latency = Date.now() - startTime;

      return {
        content: response.data.message?.content || '',
        model: this.config.modelName,
        provider: 'ollama' as LLMProvider,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`Ollama chat failed: ${error.message}`);
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const models = await this.listModels();
    const targetModel = modelName || this.config.modelName;
    return models.some(m => m.name === targetModel || m.name === `${targetModel}:latest`);
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName?: string): Promise<ModelInfo | null> {
    const models = await this.listModels();
    const targetModel = modelName || this.config.modelName;
    return models.find(m => m.name === targetModel || m.name === `${targetModel}:latest`) || null;
  }
}