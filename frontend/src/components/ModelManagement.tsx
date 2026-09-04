/**
 * Model Management Page
 * Displays list of LLM models and provides CRUD operations
 */

import { useState, useEffect } from 'react';
import type { LLMConfig, ConnectionTestResult } from '../types/llm';
import { llmApi } from '../services/llm-api';
import ModelForm from './ModelForm';

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<LLMConfig | null>(null);
  const [testingModel, setTestingModel] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Map<number, ConnectionTestResult>>(new Map());

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const data = await llmApi.getModels();
      setModels(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleAddModel = () => {
    setEditingModel(null);
    setShowForm(true);
  };

  const handleEditModel = (model: LLMConfig) => {
    setEditingModel(model);
    setShowForm(true);
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm('确定要删除此模型配置吗？')) {
      return;
    }

    try {
      await llmApi.deleteModel(id);
      await fetchModels();
    } catch (err: any) {
      setError(err.message || 'Failed to delete model');
    }
  };

  const handleTestConnection = async (id: number) => {
    try {
      setTestingModel(id);
      const result = await llmApi.testConnection(id);
      setTestResults(prev => new Map(prev).set(id, result));
    } catch (err: any) {
      setTestResults(prev => new Map(prev).set(id, {
        success: false,
        error: err.message || 'Connection test failed',
      }));
    } finally {
      setTestingModel(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await llmApi.setDefaultModel(id);
      await fetchModels();
    } catch (err: any) {
      setError(err.message || 'Failed to set default model');
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingModel) {
        await llmApi.updateModel(editingModel.id, data);
      } else {
        await llmApi.addModel(data);
      }
      setShowForm(false);
      await fetchModels();
    } catch (err: any) {
      setError(err.message || 'Failed to save model');
    }
  };

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      ollama: 'Ollama (本地)',
      zhipu: '智谱AI',
      qwen: '阿里云Qwen',
      openai: 'OpenAI',
    };
    return labels[provider] || provider;
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? <span className="badge badge-success">活跃</span>
      : <span className="badge badge-secondary">停用</span>;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="model-management">
      <div className="header">
        <h2>模型管理</h2>
        <button className="btn btn-primary" onClick={handleAddModel}>
          添加模型
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="model-list">
        {models.length === 0 ? (
          <div className="empty-state">
            <p>暂无模型配置</p>
            <button className="btn btn-primary" onClick={handleAddModel}>
              添加第一个模型
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>提供商</th>
                <th>模型</th>
                <th>状态</th>
                <th>默认</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={model.id}>
                  <td>{model.name}</td>
                  <td>{getProviderLabel(model.provider)}</td>
                  <td>{model.modelName}</td>
                  <td>{getStatusBadge(model.status)}</td>
                  <td>
                    {model.isDefault && <span className="badge badge-primary">默认</span>}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleTestConnection(model.id)}
                        disabled={testingModel === model.id}
                      >
                        {testingModel === model.id ? '测试中...' : '测试连接'}
                      </button>
                      {!model.isDefault && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSetDefault(model.id)}
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEditModel(model)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteModel(model.id)}
                      >
                        删除
                      </button>
                    </div>
                    {testResults.has(model.id) && (
                      <div className={`test-result ${testResults.get(model.id)?.success ? 'success' : 'error'}`}>
                        {testResults.get(model.id)?.success 
                          ? `连接成功 (${testResults.get(model.id)?.latency}ms)`
                          : `连接失败: ${testResults.get(model.id)?.error}`
                        }
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ModelForm
          model={editingModel}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default ModelManagement;