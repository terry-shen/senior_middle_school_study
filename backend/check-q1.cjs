const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const q = await prisma.question.findFirst({ where: { id: 1 } });
  console.log('Question 1:', q ? { id: q.id, type: q.questionType, contentLen: q.content?.length, content: q.content?.substring(0, 100) } : 'NOT FOUND');
}
main().catch(console.error).finally(() => prisma.$disconnect());
