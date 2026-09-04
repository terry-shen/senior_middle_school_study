const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.question.findUnique({ where: { id: 43 } });
  console.log('Q3 content (full):\n');
  console.log(q.content);
}
main().then(() => prisma.$disconnect());
