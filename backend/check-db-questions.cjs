const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const questions = await prisma.question.findMany({
    where: { paperId: 6 },
    select: { id: true, questionNumber: true, content: true, answer: true, analysis: true },
    orderBy: { questionNumber: 'asc' }
  });
  
  console.log('Questions in DB:', questions.length);
  questions.forEach(q => {
    const ansLen = q.answer ? q.answer.length : 0;
    const anaLen = q.analysis ? q.analysis.length : 0;
    console.log(`Q${q.questionNumber}: content=${q.content.length}, answer=${ansLen}, analysis=${anaLen}`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
