/**
 * Model Form Component
 * Handles adding and editing LLM configurations
 */

import { useState } from 'react';
import type { LLMConfig, LLMConfigFormData, LLMProvider } from '../types/llm';

interface ModelFormProps {
  model?: LLMConfig | null;
  onSubmit: (data: LLMConfigFormData) => void;
  onCancel: () => void;
}

const ModelForm: React.FC<ModelFormProps> = ({ model, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<LLMConfigFormData>({
    name: model?.name || '',
    provider: model?.provider || 'ollama',
    endpoint: model?.endpoint || 'http://localhost:11434',
    modelName: model?.modelName || '',
    apiKey: model?.apiKey || '',
    isDefault: model?.isDefault || false,
    status: model?.status || 'active',
    maxTokens: model?.maxTokens || 4096,
    temperature: model?.temperature || 0.7,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getEndpointPlaceholder = (provider: LLMProvider) => {
    const placeholders: Record<LLMProvider, string> = {
      ollama: 'http://localhost:11434',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      qwen: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      openai: 'https://api.openai.com/v1',
    };
    return placeholders[provider];
  };

  const getModelPlaceholder = (provider: LLMProvider) => {
    const placeholders: Record<LLMProvider, string> = {
      ollama: 'qwen2.5:7b',
      zhipu: 'glm-4',
      qwen: 'qwen-max',
      openai: 'gpt-4',
    };
    return placeholders[provider];
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{model ? '编辑模型' : '添加模型'}</h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">显示名称 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如：本地Qwen模型"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="provider">提供商 *</label>
            <select
              id="provider"
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              required
            >
              <option value="ollama">Ollama (本地)</option>
              <option value="zhipu">智谱AI</option>
              <option value="qwen">阿里云Qwen</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="endpoint">API端点 *</label>
            <input
              type="url"
              id="endpoint"
              name="endpoint"
              value={formData.endpoint}
              onChange={handleChange}
              placeholder={getEndpointPlaceholder(formData.provider)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="modelName">模型名称 *</label>
            <input
              type="text"
              id="modelName"
              name="modelName"
              value={formData.modelName}
              onChange={handleChange}
              placeholder={getModelPlaceholder(formData.provider)}
              required
            />
          </div>

          {formData.provider !== 'ollama' && (
            <div className="form-group">
              <label htmlFor="apiKey">API密钥 *</label>
              <input
                type="password"
                id="apiKey"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                placeholder="输入API密钥"
                required
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="maxTokens">最大Token数</label>
              <input
                type="number"
                id="maxTokens"
                name="maxTokens"
                value={formData.maxTokens}
                onChange={handleChange}
                min={1}
                max={128000}
              />
            </div>

            <div className="form-group">
              <label htmlFor="temperature">温度</label>
              <input
                type="number"
                id="temperature"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleCheckboxChange}
                />
                设为默认模型
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="status">状态</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">活跃</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {model ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModelForm;