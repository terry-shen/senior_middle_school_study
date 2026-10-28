/**
 * Seed Volcengine API Gateway models into LLMConfig.
 * Idempotent: upsert by unique `name`.
 * Default = deepseek-v4.1-flash (fastest stable model, ~1.4s).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ENDPOINT = 'https://st8tp3ajl0df3n8b8l8qu.apigateway-cn-beijing.volceapi.com/v1';
const API_KEY = '04d34a78-c95d-44ae-99b4-dba069f32c35';

// [modelName, displayName, maxTokens, temperature]
const MODELS = [
  ['deepseek-v4.1-flash', 'Volcengine DeepSeek V4.1 Flash', 8192, 0.7],
  ['deepseek-v4-flash', 'Volcengine DeepSeek V4 Flash', 8192, 0.7],
  ['deepseek-v4-pro', 'Volcengine DeepSeek V4 Pro', 8192, 0.7],
  ['doubao-seed-2.1-pro', 'Volcengine Doubao Seed 2.1 Pro', 8192, 0.7],
  ['glm-5.2', 'Volcengine GLM 5.2', 8192, 0.7],
  ['glm-5.3', 'Volcengine GLM 5.3', 8192, 0.7],
  ['glm-5.3-flash', 'Volcengine GLM 5.3 Flash', 8192, 0.7],
  ['hy3', 'Volcengine Hy3', 8192, 0.7],
  ['kimi-k2.7-code', 'Volcengine Kimi K2.7 Code', 8192, 0.7],
  ['kimi-k3', 'Volcengine Kimi K3', 8192, 1.0],            // only temperature=1 allowed
  ['MiniMax-M3', 'Volcengine MiniMax M3', 8192, 0.7],
  ['qwen3.7-max', 'Volcengine Qwen3.7 Max', 8192, 0.7],
  ['qwen3.7-plus', 'Volcengine Qwen3.7 Plus', 8192, 0.7],
  ['qwen3.8-flash', 'Volcengine Qwen3.8 Flash', 8192, 0.7],
  ['qwen3.8-max', 'Volcengine Qwen3.8 Max', 8192, 0.7],
  ['tencent/kimi-k3', 'Volcengine Tencent Kimi K3', 8192, 0.7],
  ['volcengine/deepseek-v4.1-flash', 'Volcengine VE DeepSeek V4.1 Flash', 8192, 0.7],
  ['zhipu/glm-5.3', 'Volcengine Zhipu GLM 5.3', 8192, 0.7],
];

const DEFAULT_MODEL = 'deepseek-v4.1-flash';

(async () => {
  for (const [modelName, name, maxTokens, temperature] of MODELS) {
    const data = {
      provider: 'openai',
      endpoint: ENDPOINT,
      modelName,
      apiKey: API_KEY,
      status: 'active',
      maxTokens,
      temperature,
      isDefault: modelName === DEFAULT_MODEL,
    };
    const row = await prisma.lLMConfig.upsert({
      where: { name },
      create: { name, ...data },
      update: data,
    });
    console.log(`seeded id=${row.id} ${modelName}`);
  }
  console.log('\n--- current LLMConfig ---');
  const all = await prisma.lLMConfig.findMany({ orderBy: { id: 'asc' } });
  all.forEach((r) =>
    console.log(`${r.id} | ${r.name} | ${r.modelName} | default=${r.isDefault} | temp=${r.temperature}`)
  );
  await prisma.$disconnect();
})();
