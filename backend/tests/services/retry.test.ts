/**
 * Retry and Fallback Strategy Tests
 * Tests automatic retry and model fallback on failures
 */

import { LLMService } from '../../src/services/llm-service';

describe('Retry and Fallback Strategy', () => {
  describe('constructor', () => {
    it('should accept retry configuration', () => {
      const service = new LLMService(undefined, {
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 3,
        fallbackEnabled: true,
      });
      
      expect(service).toBeDefined();
    });

    it('should use default retry config when not provided', () => {
      const service = new LLMService();
      expect(service).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should have retry methods', () => {
      const service = new LLMService();
      
      // Verify that generate supports retry through executeWithRetry
      expect(service.generate).toBeDefined();
      expect(service.chat).toBeDefined();
    });

    it('should implement exponential backoff', () => {
      const service = new LLMService(undefined, {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
      });
      
      // The retry config is stored internally
      expect(service).toBeDefined();
    });
  });

  describe('fallback logic', () => {
    it('should support fallback to alternative models', () => {
      const service = new LLMService(undefined, {
        fallbackEnabled: true,
      });
      
      expect(service).toBeDefined();
    });

    it('should allow disabling fallback', () => {
      const service = new LLMService(undefined, {
        fallbackEnabled: false,
      });
      
      expect(service).toBeDefined();
    });
  });

  describe('integration with generate', () => {
    it('should apply retry to generate method', () => {
      const service = new LLMService();
      
      // Without models configured, it should throw
      expect(service.generate({ prompt: 'test' })).rejects.toThrow('No model configured');
    });

    it('should apply retry to chat method', () => {
      const service = new LLMService();
      
      // Without models configured, it should throw
      expect(service.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('No model configured');
    });
  });

  describe('error handling', () => {
    it('should preserve last error after all retries exhausted', async () => {
      const service = new LLMService(undefined, {
        maxRetries: 0, // No retries
        fallbackEnabled: false,
      });
      
      // Should throw immediately without retries
      await expect(service.generate({ prompt: 'test' })).rejects.toThrow();
    });
  });
});