/**
 * LLM API Service
 * Handles communication with backend LLM endpoints
 */

import type { LLMConfig, LLMConfigFormData, ConnectionTestResult, CallStats } from '../types/llm';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class LLMApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  /**
   * Get all active LLM configurations
   */
  async getModels(): Promise<LLMConfig[]> {
    const response = await fetch(`${this.baseUrl}/llm/models`);
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    return response.json();
  }

  /**
   * Get a specific LLM configuration
   */
  async getModel(id: number): Promise<LLMConfig> {
    const response = await fetch(`${this.baseUrl}/llm/models/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch model');
    }
    return response.json();
  }

  /**
   * Add a new LLM configuration
   */
  async addModel(config: LLMConfigFormData): Promise<LLMConfig> {
    const response = await fetch(`${this.baseUrl}/llm/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error('Failed to add model');
    }
    return response.json();
  }

  /**
   * Update an existing LLM configuration
   */
  async updateModel(id: number, config: Partial<LLMConfigFormData>): Promise<LLMConfig> {
    const response = await fetch(`${this.baseUrl}/llm/models/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error('Failed to update model');
    }
    return response.json();
  }

  /**
   * Delete an LLM configuration
   */
  async deleteModel(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/llm/models/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete model');
    }
  }

  /**
   * Test connection to an LLM provider
   */
  async testConnection(id: number): Promise<ConnectionTestResult> {
    const response = await fetch(`${this.baseUrl}/llm/models/${id}/test`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to test connection' }));
      throw new Error(error.error || 'Failed to test connection');
    }
    return response.json();
  }

  /**
   * Set default model
   */
  async setDefaultModel(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/llm/models/${id}/default`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to set default model');
    }
  }

  /**
   * Get call statistics for a model
   */
  async getCallStats(modelId?: number, startDate?: Date, endDate?: Date): Promise<CallStats> {
    const params = new URLSearchParams();
    if (modelId) params.append('modelId', modelId.toString());
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await fetch(`${this.baseUrl}/llm/stats?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }
    return response.json();
  }

  /**
   * Get recent call logs
   */
  async getRecentCalls(limit: number = 100, modelId?: number): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (modelId) params.append('modelId', modelId.toString());

    const response = await fetch(`${this.baseUrl}/llm/calls?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch call logs');
    }
    return response.json();
  }
}

export const llmApi = new LLMApiService();