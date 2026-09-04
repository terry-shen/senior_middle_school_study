/**
 * OpenAI Adapter
 * Implements LLM operations for OpenAI GPT models
 */

import axios, { AxiosInstance } from 'axios';
import { LLMConfig, LLMRequest, LLMResponse, ConnectionTestResult, ModelInfo, LLMProvider } from '../types/llm';

export class OpenAIAdapter {
  private client: AxiosInstance;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.openai.com/v1',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // Test by listing models (support all OpenAI-compatible endpoints, not just GPT)
      const response = await this.client.get('/models');
      const latency = Date.now() - startTime;
      
      const models: ModelInfo[] = response.data.data
        ?.map((m: any) => ({
          name: m.id,
          modifiedAt: m.created ? new Date(m.created * 1000).toISOString() : undefined,
        })) || [];

      return {
        success: true,
        latency,
        models,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Connection failed',
      };
    }
  }

  /**
   * Get list of available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data
        ?.map((m: any) => ({
          name: m.id,
          modifiedAt: m.created ? new Date(m.created * 1000).toISOString() : undefined,
        })) || [];
    } catch (error) {
      throw new Error('Failed to fetch models from OpenAI');
    }
  }

  /**
   * Generate completion using OpenAI Chat API
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const messages = [];
      if (request.system) {
        messages.push({ role: 'system', content: request.system });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await this.client.post('/chat/completions', {
        model: this.config.modelName,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
        stop: request.stop,
      });

      const latency = Date.now() - startTime;
      const usage = response.data.usage;
      const message = response.data.choices[0]?.message || {};

      // Handle reasoning models (e.g., GLM-5.2): content may be empty,
      // with the actual output in reasoning_content
      let content = message.content || '';
      if (!content && message.reasoning_content) {
        content = message.reasoning_content;
      }

      return {
        content,
        model: this.config.modelName,
        provider: 'openai' as LLMProvider,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`OpenAI generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Generate chat completion
   */
  async chat(messages: Array<{ role: string; content: string }>, options?: Partial<LLMRequest>): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.modelName,
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        stop: options?.stop,
      });

      const latency = Date.now() - startTime;
      const usage = response.data.usage;
      const message = response.data.choices[0]?.message || {};

      // Handle reasoning models (e.g., GLM-5.2): content may be empty,
      // with the actual output in reasoning_content
      let content = message.content || '';
      if (!content && message.reasoning_content) {
        content = message.reasoning_content;
      }

      return {
        content,
        model: this.config.modelName,
        provider: 'openai' as LLMProvider,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`OpenAI chat failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}