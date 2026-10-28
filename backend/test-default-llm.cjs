/** Verify default LLM works through the app's own LLMService (same path as difficulty/grading services). */
const { PrismaClient } = require('@prisma/client');
const { LLMService } = require('./dist/services/llm-service');

const prisma = new PrismaClient();

(async () => {
  const svc = new LLMService(prisma);
  const t0 = Date.now();
  try {
    const res = await svc.generate({
      prompt: '用一句话说明二次函数的定义。',
      maxTokens: 512,
      temperature: 0.3,
    });
    console.log('OK  elapsed:', Date.now() - t0, 'ms');
    console.log('content:', (res.content || '').slice(0, 300));
  } catch (e) {
    console.log('FAIL', Date.now() - t0, 'ms');
    console.log('error:', e.message);
  }
  await prisma.$disconnect();
})();
