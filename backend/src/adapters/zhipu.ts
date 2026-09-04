/**
 * ZhipuAI Adapter
 * Implements LLM operations for ZhipuAI GLM models
 */

import axios, { AxiosInstance } from 'axios';
import { LLMConfig, LLMRequest, LLMResponse, ConnectionTestResult, LLMProvider } from '../types/llm';

export class ZhipuAdapter {
  private client: AxiosInstance;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint || 'https://open.bigmodel.cn/api/paas/v4',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
  }

  /**
   * Test connection to ZhipuAI API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // ZhipuAI doesn't have a simple test endpoint, so we do a minimal generation
      const response = await this.client.post('/chat/completions', {
        model: this.config.modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      
      const latency = Date.now() - startTime;
      return {
        success: true,
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Connection failed',
      };
    }
  }

  /**
   * Generate completion using ZhipuAI Chat API
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

      return {
        content: response.data.choices[0]?.message?.content || '',
        model: this.config.modelName,
        provider: 'zhipu' as LLMProvider,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`ZhipuAI generation failed: ${error.response?.data?.error?.message || error.message}`);
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

      return {
        content: response.data.choices[0]?.message?.content || '',
        model: this.config.modelName,
        provider: 'zhipu' as LLMProvider,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency,
      };
    } catch (error: any) {
      throw new Error(`ZhipuAI chat failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}