const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete ALL questions for paper 6
  const result = await prisma.question.deleteMany({ where: { paperId: 6 } });
  console.log('Deleted questions:', result.count);
  
  // Reset paper status
  await prisma.examPaper.update({ where: { id: 6 }, data: { status: 'uploaded' } });
  console.log('Paper 6 status reset to uploaded');
  
  // Check remaining questions
  const count = await prisma.question.count({ where: { paperId: 6 } });
  console.log('Remaining questions for paper 6:', count);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
