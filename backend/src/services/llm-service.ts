/**
 * LLM Service
 * Unified interface for all LLM providers
 */

import { PrismaClient } from '@prisma/client';
import { OllamaAdapter } from '../adapters/ollama';
import { ZhipuAdapter } from '../adapters/zhipu';
import { QwenAdapter } from '../adapters/qwen';
import { OpenAIAdapter } from '../adapters/openai';
import * as crypto from 'crypto';
import { LLMConfig, LLMRequest, LLMResponse, ConnectionTestResult, LLMProvider, RetryConfig, CacheEntry } from '../types/llm';

export class LLMService {
  private prisma: PrismaClient;
  private adapters: Map<string, any> = new Map();
  private defaultModelId: number | null = null;
  private retryConfig: RetryConfig;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(prisma?: PrismaClient, retryConfig?: Partial<RetryConfig>, cacheConfig?: { enabled?: boolean; ttl?: number }) {
    this.prisma = prisma || new PrismaClient();
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      retryDelay: retryConfig?.retryDelay ?? 1000,
      backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
      fallbackEnabled: retryConfig?.fallbackEnabled ?? true,
    };
    this.cacheEnabled = cacheConfig?.enabled ?? true;
    this.cacheTTL = cacheConfig?.ttl ?? 3600; // Default 1 hour
  }

  /**
   * Initialize adapters for all active models in database
   */
  async initialize(): Promise<void> {
    const models = await this.prisma.lLMConfig.findMany({
      where: { status: 'active' },
    });

    for (const model of models) {
      await this.registerAdapter(model);
      if (model.isDefault) {
        this.defaultModelId = model.id;
      }
    }
  }

  /**
   * Register an adapter for a model configuration
   */
  private async registerAdapter(config: any): Promise<void> {
    const llmConfig: LLMConfig = {
      id: config.id,
      name: config.name,
      provider: config.provider as LLMProvider,
      endpoint: config.endpoint,
      modelName: config.modelName,
      apiKey: config.apiKey || undefined,
      isDefault: config.isDefault,
      status: config.status,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    };

    let adapter;
    switch (llmConfig.provider) {
      case 'ollama':
        adapter = new OllamaAdapter(llmConfig);
        break;
      case 'zhipu':
        adapter = new ZhipuAdapter(llmConfig);
        break;
      case 'qwen':
        adapter = new QwenAdapter(llmConfig);
        break;
      case 'openai':
        adapter = new OpenAIAdapter(llmConfig);
        break;
      default:
        throw new Error(`Unknown provider: ${llmConfig.provider}`);
    }

    this.adapters.set(config.id.toString(), adapter);
  }

  /**
   * Get adapter by model ID (lazy-loads from database if not in memory)
   */
  private async getAdapter(modelId?: number): Promise<any> {
    const id = modelId || this.defaultModelId;
    if (!id) {
      // Try to load default from database
      const defaultModel = await this.prisma.lLMConfig.findFirst({ where: { isDefault: true, status: 'active' } });
      if (defaultModel) {
        this.defaultModelId = defaultModel.id;
        await this.registerAdapter(defaultModel);
        return this.adapters.get(defaultModel.id.toString());
      }
      throw new Error('No model configured');
    }

    let adapter = this.adapters.get(id.toString());
    if (!adapter) {
      // Lazy-load from database
      const config = await this.prisma.lLMConfig.findUnique({ where: { id } });
      if (!config || config.status !== 'active') {
        throw new Error(`Model ${id} not found or inactive`);
      }
      await this.registerAdapter(config);
      adapter = this.adapters.get(id.toString());
    }

    if (!adapter) {
      throw new Error(`Model ${id} not found or inactive`);
    }

    return adapter;
  }

/**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate hash for a request
   */
  private hashRequest(request: LLMRequest, modelId: number): string {
    const content = JSON.stringify({
      prompt: request.prompt,
      system: request.system,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      modelId,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached response
   */
  private getCachedResponse(requestHash: string): CacheEntry | null {
    if (!this.cacheEnabled) return null;

    const entry = this.cache.get(requestHash);
    if (!entry) return null;

    // Check if cache entry has expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(requestHash);
      return null;
    }

    return entry;
  }

  /**
   * Store response in cache
   */
  private cacheResponse(requestHash: string, response: LLMResponse, modelId: number): void {
    if (!this.cacheEnabled) return;

    const now = new Date();
    const entry: CacheEntry = {
      requestHash,
      response: { ...response, cached: true },
      modelId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.cacheTTL * 1000),
    };

    this.cache.set(requestHash, entry);
  }

  /**
   * Clear all cached responses
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get fallback model IDs (active models excluding the failed one)
   */
  private async getFallbackModels(excludeModelId?: number): Promise<number[]> {
    const models = await this.prisma.lLMConfig.findMany({
      where: {
        status: 'active',
        id: excludeModelId ? { not: excludeModelId } : undefined,
      },
      orderBy: { isDefault: 'desc' },
    });

    return models.map(m => m.id);
  }

  /**
   * Execute with retry and fallback logic
   */
  private async executeWithRetry<T>(
    operation: (modelId: number) => Promise<T>,
    initialModelId: number
  ): Promise<T> {
    let currentModelId = initialModelId;
    let lastError: Error | null = null;
    let retryDelay = this.retryConfig.retryDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation(currentModelId);
      } catch (error: any) {
        lastError = error;

        // If this is the last retry, try fallback
        if (attempt === this.retryConfig.maxRetries) {
          if (this.retryConfig.fallbackEnabled) {
            const fallbackModels = await this.getFallbackModels(initialModelId);
            
            for (const fallbackModelId of fallbackModels) {
              try {
                return await operation(fallbackModelId);
              } catch (fallbackError) {
                // Continue to next fallback
              }
            }
          }
          
          // All retries and fallbacks failed
          throw lastError;
        }

        // Wait before retrying
        await this.sleep(retryDelay);
        retryDelay *= this.retryConfig.backoffMultiplier;
      }
    }

    throw lastError;
  }

  /**
   * Generate completion (synchronous)
   */
  async generate(request: LLMRequest, modelId?: number): Promise<LLMResponse> {
    const targetModelId = modelId || this.defaultModelId!;
    
    // Check cache first
    const requestHash = this.hashRequest(request, targetModelId);
    const cachedEntry = this.getCachedResponse(requestHash);
    
    if (cachedEntry) {
      // Return cached response
      return cachedEntry.response;
    }
    
    // Execute with retry and fallback
    return await this.executeWithRetry(async (currentModelId) => {
      const adapter = await this.getAdapter(currentModelId);
      
      const response = await adapter.generate(request);
      
      // Store in cache
      const currentRequestHash = this.hashRequest(request, currentModelId);
      this.cacheResponse(currentRequestHash, response, currentModelId);
      
      // Log successful call
      await this.logCall({
        modelId: currentModelId,
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        latency: response.latency,
        success: true,
        requestHash: currentRequestHash,
        cached: false,
      });
      
      return response;
    }, targetModelId);
  }

  /**
   * Generate chat completion (synchronous)
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: Partial<LLMRequest>,
    modelId?: number
  ): Promise<LLMResponse> {
    const targetModelId = modelId || this.defaultModelId!;
    
    return await this.executeWithRetry(async (currentModelId) => {
      const adapter = await this.getAdapter(currentModelId);
      
      let response;
      if (!adapter.chat) {
        // Fallback to generate if chat is not supported
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        response = await adapter.generate({ prompt, ...options });
      } else {
        response = await adapter.chat(messages, options);
      }
      
      // Log successful call
      await this.logCall({
        modelId: currentModelId,
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        latency: response.latency,
        success: true,
      });
      
      return response;
    }, targetModelId);
  }

  /**
   * Test connection to a model
   */
  async testConnection(modelId?: number): Promise<ConnectionTestResult> {
    const adapter = await this.getAdapter(modelId);
    return await adapter.testConnection();
  }

  /**
   * List available models for a provider
   */
  async listModels(modelId?: number): Promise<any> {
    const adapter = await this.getAdapter(modelId);
    if (!adapter.listModels) {
      throw new Error('This provider does not support model listing');
    }
    return await adapter.listModels();
  }

  /**
   * Add a new model configuration
   */
  async addModel(config: Omit<LLMConfig, 'id'>): Promise<LLMConfig> {
    const model = await this.prisma.lLMConfig.create({
      data: {
        name: config.name,
        provider: config.provider,
        endpoint: config.endpoint,
        modelName: config.modelName,
        apiKey: config.apiKey,
        isDefault: config.isDefault,
        status: config.status,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      },
    });

    await this.registerAdapter(model);
    
    if (config.isDefault) {
      this.defaultModelId = model.id;
    }

    return {
      id: model.id,
      name: model.name,
      provider: model.provider as LLMProvider,
      endpoint: model.endpoint,
      modelName: model.modelName,
      apiKey: model.apiKey || undefined,
      isDefault: model.isDefault,
      status: model.status as 'active' | 'inactive',
      maxTokens: model.maxTokens || undefined,
      temperature: model.temperature || undefined,
    };
  }

  /**
   * Set default model
   */
  async setDefaultModel(modelId: number): Promise<void> {
    // Update database
    await this.prisma.lLMConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    await this.prisma.lLMConfig.update({
      where: { id: modelId },
      data: { isDefault: true },
    });

    // Update runtime
    this.defaultModelId = modelId;
  }

  /**
   * Get all active models
   */
  async getActiveModels(): Promise<LLMConfig[]> {
    const models = await this.prisma.lLMConfig.findMany({
      where: { status: 'active' },
    });

    return models.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider as LLMProvider,
      endpoint: m.endpoint,
      modelName: m.modelName,
      apiKey: m.apiKey || undefined,
      isDefault: m.isDefault,
      status: m.status as 'active' | 'inactive',
      maxTokens: m.maxTokens || undefined,
      temperature: m.temperature || undefined,
    }));
  }

  /**
   * Log a model call to the database
   */
  private async logCall(data: {
    modelId: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latency: number;
    success: boolean;
    errorMessage?: string;
    requestHash?: string;
    cached?: boolean;
  }): Promise<void> {
    try {
      await this.prisma.lLMCallLog.create({
        data: {
          modelId: data.modelId,
          promptTokens: data.promptTokens || 0,
          completionTokens: data.completionTokens || 0,
          totalTokens: data.totalTokens || 0,
          latency: data.latency,
          success: data.success,
          errorMessage: data.errorMessage,
          requestHash: data.requestHash,
          cached: data.cached || false,
        },
      });
    } catch (error) {
      // Don't fail the request if logging fails
      console.error('Failed to log LLM call:', error);
    }
  }

  /**
   * Get call statistics for a model
   */
  async getCallStats(modelId?: number, startDate?: Date, endDate?: Date): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgLatency: number;
    totalTokens: number;
    successRate: number;
  }> {
    const where: any = {};
    if (modelId) where.modelId = modelId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const calls = await this.prisma.lLMCallLog.findMany({ where });

    const totalCalls = calls.length;
    const successfulCalls = calls.filter(c => c.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const avgLatency = totalCalls > 0 
      ? Math.round(calls.reduce((sum, c) => sum + c.latency, 0) / totalCalls) 
      : 0;
    const totalTokens = calls.reduce((sum, c) => sum + c.totalTokens, 0);
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      avgLatency,
      totalTokens,
      successRate,
    };
  }

  /**
   * Get recent call logs
   */
  async getRecentCalls(limit: number = 100, modelId?: number): Promise<any[]> {
    const where: any = {};
    if (modelId) where.modelId = modelId;

    return await this.prisma.lLMCallLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Disconnect Prisma client
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}