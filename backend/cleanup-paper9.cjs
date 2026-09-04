const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Delete old questions for paper 9
  const del = await prisma.question.deleteMany({ where: { paperId: 9 } });
  console.log('Deleted', del.count, 'old questions');
  await prisma.examPaper.update({ where: { id: 9 }, data: { status: 'uploaded' } });
  console.log('Paper 9 status reset to uploaded');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
