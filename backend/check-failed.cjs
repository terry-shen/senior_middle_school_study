const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ids = [141, 144, 147, 150, 152];
  for (const id of ids) {
    const q = await prisma.question.findUnique({ where: { id }, select: { id: true, content: true } });
    const first100 = q.content.substring(0, 100).replace(/\n/g, ' ');
    const isEnglish = /^(The user|Let me|I need)/.test(q.content.trim());
    console.log(`Q${id} (${q.content.length}ch) English=${isEnglish}: ${first100}...`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
