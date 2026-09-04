/**
 * LLM Service Tests
 * Tests the unified LLM interface
 */

import { LLMService } from '../../src/services/llm-service';

describe('LLMService', () => {
  describe('constructor', () => {
    it('should create service instance', () => {
      const service = new LLMService();
      expect(service).toBeDefined();
    });
  });

  // Note: Tests that require database connection should be run with
  // a test database or mocked Prisma client
  
  describe('getAdapter', () => {
    it('should throw error when no model configured', () => {
      const service = new LLMService();
      expect(() => service.generate({ prompt: 'test' })).rejects.toThrow('No model configured');
    });
  });
});