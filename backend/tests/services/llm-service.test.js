"use strict";
/**
 * LLM Service Tests
 * Tests the unified LLM interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
const llm_service_1 = require("../../src/services/llm-service");
describe('LLMService', () => {
    describe('constructor', () => {
        it('should create service instance', () => {
            const service = new llm_service_1.LLMService();
            expect(service).toBeDefined();
        });
    });
    // Note: Tests that require database connection should be run with
    // a test database or mocked Prisma client
    describe('getAdapter', () => {
        it('should throw error when no model configured', () => {
            const service = new llm_service_1.LLMService();
            expect(() => service.generate({ prompt: 'test' })).rejects.toThrow('No model configured');
        });
    });
});
//# sourceMappingURL=llm-service.test.js.map