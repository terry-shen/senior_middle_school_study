/**
 * Cloud LLM Adapters Tests
 * Tests ZhipuAI, Qwen, and OpenAI adapters
 */

import { ZhipuAdapter } from '../../src/adapters/zhipu';
import { QwenAdapter } from '../../src/adapters/qwen';
import { OpenAIAdapter } from '../../src/adapters/openai';
import { LLMConfig } from '../../src/types/llm';

describe('Cloud LLM Adapters', () => {
  const zhipuConfig: LLMConfig = {
    id: 2,
    name: 'Test Zhipu',
    provider: 'zhipu',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-4',
    apiKey: 'test-api-key',
    isDefault: false,
    status: 'active',
  };

  const qwenConfig: LLMConfig = {
    id: 3,
    name: 'Test Qwen',
    provider: 'qwen',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    modelName: 'qwen-max',
    apiKey: 'test-api-key',
    isDefault: false,
    status: 'active',
  };

  const openaiConfig: LLMConfig = {
    id: 4,
    name: 'Test OpenAI',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    modelName: 'gpt-4',
    apiKey: 'test-api-key',
    isDefault: false,
    status: 'active',
  };

  describe('ZhipuAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new ZhipuAdapter(zhipuConfig);
      expect(adapter).toBeDefined();
    });

    it('should test connection (will fail with test API key)', async () => {
      const adapter = new ZhipuAdapter(zhipuConfig);
      const result = await adapter.testConnection();
      
      // Expect failure with test API key
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('QwenAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new QwenAdapter(qwenConfig);
      expect(adapter).toBeDefined();
    });

    it('should test connection (will fail with test API key)', async () => {
      const adapter = new QwenAdapter(qwenConfig);
      const result = await adapter.testConnection();
      
      // Expect failure with test API key
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('OpenAIAdapter', () => {
    it('should create adapter with config', () => {
      const adapter = new OpenAIAdapter(openaiConfig);
      expect(adapter).toBeDefined();
    });

    it('should test connection (will fail with test API key)', async () => {
      const adapter = new OpenAIAdapter(openaiConfig);
      const result = await adapter.testConnection();
      
      // Expect failure with test API key
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});