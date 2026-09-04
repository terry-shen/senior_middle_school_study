const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.lLMConfig.findMany({
    select: { id: true, name: true, provider: true, modelName: true, isDefault: true, status: true }
  });
  rows.forEach(r => console.log(`${r.id} | ${r.name} | ${r.provider} | ${r.modelName} | default:${r.isDefault} | ${r.status}`));
  const c = await prisma.lLMConfig.count();
  console.log('total:', c);
}

main().catch(console.error).finally(() => prisma.$disconnect());
