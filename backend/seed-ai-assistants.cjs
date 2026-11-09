/**
 * 初始化 AI 助理导航站点（幂等：按 code upsert，不覆盖管理员已改的 url）
 * 用法：node seed-ai-assistants.cjs
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SITES = [
  {
    code: 'doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    icon: '🫘',
    description: '字节跳动豆包，日常答疑与解题思路',
    order: 1,
  },
  {
    code: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    icon: '🐋',
    description: 'DeepSeek 深度思考，数学推理与代码',
    order: 2,
  },
  {
    code: 'workbuddy',
    name: 'WorkBuddy',
    url: '',
    icon: '💼',
    description: '请管理员填写 WorkBuddy 的访问地址',
    order: 3,
  },
];

(async () => {
  let created = 0;
  let kept = 0;
  for (const site of SITES) {
    const exists = await prisma.aiAssistant.findUnique({ where: { code: site.code } });
    if (exists) {
      kept++;
      continue;
    }
    await prisma.aiAssistant.create({ data: site });
    created++;
  }
  const total = await prisma.aiAssistant.count();
  console.log(JSON.stringify({ created, kept, total }));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
