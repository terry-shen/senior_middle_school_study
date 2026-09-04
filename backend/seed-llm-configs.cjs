/**
 * Seed LLM configurations from opencode.json into database
 * Extracts provider configs and inserts into LLMConfig table
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing LLM configs...');
  await prisma.lLMConfig.deleteMany({});
  console.log('Cleared.\n');

  const configs = [
    // === Ollama (local) ===
    {
      name: 'Ollama - qwen2.5-coder:7b (本地)',
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      modelName: 'qwen2.5-coder:7b',
      apiKey: null,
      isDefault: false,
      status: 'active',
      maxTokens: 4096,
      temperature: 0.7,
    },
    {
      name: 'Ollama - qwen3.5:4b-64k (本地)',
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      modelName: 'qwen3.5:4b-64k',
      apiKey: null,
      isDefault: false,
      status: 'active',
      maxTokens: 4096,
      temperature: 0.7,
    },
    {
      name: 'Ollama - qwen3-vl:latest (本地·视觉)',
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      modelName: 'qwen3-vl:latest',
      apiKey: null,
      isDefault: false,
      status: 'active',
      maxTokens: 4096,
      temperature: 0.7,
    },

    // === csi-provider (csi.ai - OpenAI-compatible) ===
    {
      name: 'CSI - GLM-5.2 (云端·默认)',
      provider: 'openai',
      endpoint: 'http://113.46.219.251:8080/v1',
      modelName: 'GLM-5.2',
      apiKey: 'sk-7F9jkQ7fo1nUMujpvVoavg',
      isDefault: true,
      status: 'active',
      maxTokens: 8192,
      temperature: 0.7,
    },
    {
      name: 'CSI - Qwen3.7-Plus (云端)',
      provider: 'openai',
      endpoint: 'http://113.46.219.251:8080/v1',
      modelName: 'Qwen3.7-Plus',
      apiKey: 'sk-7F9jkQ7fo1nUMujpvVoavg',
      isDefault: false,
      status: 'active',
      maxTokens: 8192,
      temperature: 0.7,
    },

    // === qwen-dashscope (Alibaba Cloud - OpenAI-compatible mode) ===
    {
      name: '阿里云 - qwen-max (云端·最强)',
      provider: 'openai',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelName: 'qwen-max',
      apiKey: 'sk-6c27fa5045b74f12a93c68af1a3bbfac',
      isDefault: false,
      status: 'active',
      maxTokens: 8192,
      temperature: 0.7,
    },
    {
      name: '阿里云 - qwen-plus (云端)',
      provider: 'openai',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelName: 'qwen-plus',
      apiKey: 'sk-6c27fa5045b74f12a93c68af1a3bbfac',
      isDefault: false,
      status: 'active',
      maxTokens: 8192,
      temperature: 0.7,
    },
    {
      name: '阿里云 - qwen-turbo (云端·快速)',
      provider: 'openai',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelName: 'qwen-turbo',
      apiKey: 'sk-6c27fa5045b74f12a93c68af1a3bbfac',
      isDefault: false,
      status: 'active',
      maxTokens: 8192,
      temperature: 0.7,
    },

    // === NVIDIA (OpenAI-compatible) ===
    {
      name: 'NVIDIA - Llama 3.3 70B (云端)',
      provider: 'openai',
      endpoint: 'https://integrate.api.nvidia.com/v1',
      modelName: 'meta/llama-3.3-70b-instruct',
      apiKey: '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',
      isDefault: false,
      status: 'active',
      maxTokens: 4096,
      temperature: 0.7,
    },
  ];

  console.log(`Inserting ${configs.length} model configurations...\n`);
  
  for (const config of configs) {
    const created = await prisma.lLMConfig.create({ data: config });
    const defaultTag = config.isDefault ? ' [DEFAULT]' : '';
    console.log(`  ✓ #${created.id} ${config.name}${defaultTag}`);
    console.log(`    Provider: ${config.provider}, Model: ${config.modelName}`);
    console.log(`    Endpoint: ${config.endpoint}`);
    console.log('');
  }

  // Initialize LLM service with new configs
  const { LLMService } = require('./dist/services/llm-service');
  const llmService = new LLMService(prisma);
  await llmService.initialize();
  
  const defaultModel = await prisma.lLMConfig.findFirst({ where: { isDefault: true } });
  console.log(`\n=== Summary ===`);
  console.log(`Total configs: ${configs.length}`);
  console.log(`Default model: ${defaultModel?.name} (${defaultModel?.modelName})`);
  console.log(`LLM service initialized.`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
