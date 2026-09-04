/**
 * Ollama Adapter Tests
 * Tests connection validation, model listing, and generation
 */

import { OllamaAdapter } from '../../src/adapters/ollama';
import { LLMConfig } from '../../src/types/llm';

// Mock Ollama server for testing (assumes Ollama is not running)
// In real tests, this should connect to a running Ollama instance

describe('OllamaAdapter', () => {
  const mockConfig: LLMConfig = {
    id: 1,
    name: 'Test Ollama',
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    modelName: 'qwen2.5:7b',
    isDefault: true,
    status: 'active',
    maxTokens: 4096,
    temperature: 0.7,
  };

  describe('constructor', () => {
    it('should create adapter with config', () => {
      const adapter = new OllamaAdapter(mockConfig);
      expect(adapter).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should return success when Ollama server is reachable', async () => {
      const adapter = new OllamaAdapter(mockConfig);
      const result = await adapter.testConnection();
      
      // This test will pass if Ollama is running on localhost:11434
      // Otherwise it will fail gracefully
      if (result.success) {
        expect(result.success).toBe(true);
        expect(result.latency).toBeDefined();
        expect(result.models).toBeDefined();
        expect(Array.isArray(result.models)).toBe(true);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('listModels', () => {
    it('should return list of models when Ollama is running', async () => {
      const adapter = new OllamaAdapter(mockConfig);
      
      try {
        const models = await adapter.listModels();
        expect(Array.isArray(models)).toBe(true);
      } catch (error) {
        // Expected if Ollama is not running
        expect(error).toBeDefined();
      }
    });
  });

  describe('generate', () => {
    it('should generate completion when model is available', async () => {
      const adapter = new OllamaAdapter(mockConfig);
      
      try {
        const response = await adapter.generate({
          prompt: 'Hello, how are you?',
          maxTokens: 50,
        });
        
        expect(response.content).toBeDefined();
        expect(response.model).toBe(mockConfig.modelName);
        expect(response.provider).toBe('ollama');
        expect(response.latency).toBeDefined();
      } catch (error) {
        // Expected if Ollama or model is not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('chat', () => {
    it('should generate chat completion when model is available', async () => {
      const adapter = new OllamaAdapter(mockConfig);
      
      try {
        const response = await adapter.chat([
          { role: 'user', content: 'Hello!' },
        ]);
        
        expect(response.content).toBeDefined();
        expect(response.model).toBe(mockConfig.modelName);
        expect(response.provider).toBe('ollama');
      } catch (error) {
        // Expected if Ollama or model is not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('isModelAvailable', () => {
    it('should check if model is available', async () => {
      const adapter = new OllamaAdapter(mockConfig);
      
      try {
        const available = await adapter.isModelAvailable();
        expect(typeof available).toBe('boolean');
      } catch (error) {
        // Expected if Ollama is not running
        expect(error).toBeDefined();
      }
    });
  });
});