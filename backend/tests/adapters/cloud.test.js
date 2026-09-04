"use strict";
/**
 * Cloud LLM Adapters Tests
 * Tests ZhipuAI, Qwen, and OpenAI adapters
 */
Object.defineProperty(exports, "__esModule", { value: true });
const zhipu_1 = require("../../src/adapters/zhipu");
const qwen_1 = require("../../src/adapters/qwen");
const openai_1 = require("../../src/adapters/openai");
describe('Cloud LLM Adapters', () => {
    const zhipuConfig = {
        id: 2,
        name: 'Test Zhipu',
        provider: 'zhipu',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        modelName: 'glm-4',
        apiKey: 'test-api-key',
        isDefault: false,
        status: 'active',
    };
    const qwenConfig = {
        id: 3,
        name: 'Test Qwen',
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        modelName: 'qwen-max',
        apiKey: 'test-api-key',
        isDefault: false,
        status: 'active',
    };
    const openaiConfig = {
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
            const adapter = new zhipu_1.ZhipuAdapter(zhipuConfig);
            expect(adapter).toBeDefined();
        });
        it('should test connection (will fail with test API key)', async () => {
            const adapter = new zhipu_1.ZhipuAdapter(zhipuConfig);
            const result = await adapter.testConnection();
            // Expect failure with test API key
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
    describe('QwenAdapter', () => {
        it('should create adapter with config', () => {
            const adapter = new qwen_1.QwenAdapter(qwenConfig);
            expect(adapter).toBeDefined();
        });
        it('should test connection (will fail with test API key)', async () => {
            const adapter = new qwen_1.QwenAdapter(qwenConfig);
            const result = await adapter.testConnection();
            // Expect failure with test API key
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
    describe('OpenAIAdapter', () => {
        it('should create adapter with config', () => {
            const adapter = new openai_1.OpenAIAdapter(openaiConfig);
            expect(adapter).toBeDefined();
        });
        it('should test connection (will fail with test API key)', async () => {
            const adapter = new openai_1.OpenAIAdapter(openaiConfig);
            const result = await adapter.testConnection();
            // Expect failure with test API key
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
//# sourceMappingURL=cloud.test.js.map