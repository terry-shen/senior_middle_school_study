const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.question.count();
  console.log('Total questions:', total);

  const questions = await prisma.question.findMany({
    select: { id: true, questionType: true, difficulty: true, content: true },
    take: 10
  });

  console.log('\nFirst 10 questions:');
  questions.forEach(q => {
    console.log(`  id=${q.id} type=${q.questionType} diff=${q.difficulty} content="${q.content?.substring(0, 40)}..."`);
  });

  // Count by type
  const byType = await prisma.question.groupBy({
    by: ['questionType'],
    _count: true
  });
  console.log('\nBy type:', JSON.stringify(byType));

  // Count by difficulty
  const byDiff = await prisma.question.groupBy({
    by: ['difficulty'],
    _count: true
  });
  console.log('By difficulty:', JSON.stringify(byDiff));
}

main().catch(console.error).finally(() => prisma.$disconnect());
