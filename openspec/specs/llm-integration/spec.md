# llm-integration Specification

## Purpose
提供大模型集成的统一适配层，支持本地Ollama部署模型和云端模型供应商API的无缝切换，为试题解析、答案生成、难度评估等AI功能提供底层能力支撑。

## Requirements

### Requirement: 多模型后端支持
系统 SHALL 支持连接多种大模型后端，包括本地Ollama部署模型和云端模型供应商API（OpenAI、智谱AI、讯飞星火等）。

#### Scenario: 配置Ollama本地模型
- **WHEN** 管理员配置本地Ollama服务地址和模型名称（如qwen2.5:7b, deepseek-coder:6.7b）
- **THEN** 系统验证连接成功并注册该模型为可用后端

#### Scenario: 配置云端模型API
- **WHEN** 管理员配置云端模型供应商的API密钥和端点
- **THEN** 系统验证API可用并注册该模型为可用后端

### Requirement: 统一模型调用接口
系统 SHALL 提供统一的模型调用接口，屏蔽不同模型后端的差异，支持同步和异步调用模式。

#### Scenario: 调用本地模型
- **WHEN** 系统通过统一接口调用已配置的Ollama模型
- **THEN** 系统将请求转换为Ollama API格式并返回标准化响应

#### Scenario: 调用云端模型
- **WHEN** 系统通过统一接口调用已配置的云端模型API
- **THEN** 系统将请求转换为对应供应商格式并返回标准化响应

### Requirement: 模型热切换
系统 SHALL 支持在运行时切换不同的模型后端，无需重启服务。

#### Scenario: 切换默认模型
- **WHEN** 管理员将默认模型从"Ollama-Qwen"切换为"智谱AI-GLM4"
- **THEN** 后续AI请求自动路由到新模型，历史调用记录保留

#### Scenario: 按任务选择模型
- **WHEN** 系统执行不同AI任务（试题解析vs答案生成）
- **THEN** 系统可根据任务类型选择最适合的模型配置

### Requirement: 调用监控与限制
系统 SHALL 监控模型调用状态，支持调用频率限制和失败重试机制。

#### Scenario: 监控调用状态
- **WHEN** 系统执行模型调用
- **THEN** 系统记录调用次数、耗时、Token使用量和成功率

#### Scenario: 失败重试
- **WHEN** 模型调用失败（网络错误或API限流）
- **THEN** 系统按配置策略进行重试或切换到备用模型后端

### Requirement: 模型响应缓存
系统 SHALL 支持缓存模型响应结果，避免重复调用相同请求。

#### Scenario: 缓存命中
- **WHEN** 系统收到与已缓存请求相同的Prompt
- **THEN** 系统直接返回缓存结果而不调用模型

#### Scenario: 缓存失效
- **WHEN** 缓存过期或管理员主动清除缓存
- **THEN** 系统重新调用模型获取最新结果
