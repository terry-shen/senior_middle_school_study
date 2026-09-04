const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Delete ALL existing questions for paper 6
  const deleted = await prisma.question.deleteMany({ where: { paperId: 6 } });
  console.log('Deleted', deleted.count, 'old questions');
  
  // Reset paper status
  await prisma.examPaper.update({ where: { id: 6 }, data: { status: 'uploaded' } });
  console.log('Paper status reset to uploaded');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
