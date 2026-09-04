const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ids = [141, 144, 147, 150, 152];
  for (const id of ids) {
    const q = await prisma.question.findUnique({ where: { id }, select: { content: true } });
    const first = q.content.substring(0, 80).replace(/\n/g, ' ');
    const len = q.content.length;
    const isEng = /^(The user|Let me|I need|1\.|用户希望)/i.test(q.content.trim());
    console.log(`Q${id} (${len}ch) EngCoT=${isEng}: ${first}...`);
  }
}
main().then(() => prisma.$disconnect());
