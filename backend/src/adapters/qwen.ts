/**
 * Qwen Adapter (Alibaba Cloud)
 * Implements LLM operations for Qwen models via Alibaba Cloud API
 */

import axios, { AxiosInstance } from 'axios';
import { LLMConfig, LLMRequest, LLMResponse, ConnectionTestResult, LLMProvider } from '../types/llm';

export class QwenAdapter {
  private client: AxiosInstance;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
  }

  /**
   * Test connection to Qwen API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // Qwen API test via minimal generation
      const response = await this.client.post('', {
        model: this.config.modelName,
        input: {
          messages: [{ role: 'user', content: 'test' }],
        },
        parameters: {
          max_tokens: 5,
        },
      });
      
      const latency = Date.now() - startTime;
      return {
        success: true,
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  /**
   * Generate completion using Qwen API
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const messages = [];
      if (request.system) {
        messages.push({ role: 'system', content: request.system });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await this.client.post('', {
        model: this.config.modelName,
        input: {
          messages,
        },
        parameters: {
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
          stop: request.stop,
        },
      });

      const latency = Date.now() - startTime;
      const usage = response.data.usage;

      return {
        content: response.data.output?.choices[0]?.message?.content || '',
        model: this.config.modelName,
        provider: 'qwen' as LLMProvider,
        usage: {
          promptTokens: usage?.input_tokens || 0,
          completionTokens: usage?.output_tokens || 0,
          totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`Qwen generation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate chat completion
   */
  async chat(messages: Array<{ role: string; content: string }>, options?: Partial<LLMRequest>): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.post('', {
        model: this.config.modelName,
        input: {
          messages,
        },
        parameters: {
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
          stop: options?.stop,
        },
      });

      const latency = Date.now() - startTime;
      const usage = response.data.usage;

      return {
        content: response.data.output?.choices[0]?.message?.content || '',
        model: this.config.modelName,
        provider: 'qwen' as LLMProvider,
        usage: {
          promptTokens: usage?.input_tokens || 0,
          completionTokens: usage?.output_tokens || 0,
          totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`Qwen chat failed: ${error.response?.data?.message || error.message}`);
    }
  }
}