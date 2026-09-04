const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 } });
  console.log('Paper 6:', paper?.title);
  console.log('parsedMarkdown length:', paper?.parsedMarkdown?.length || 0);
  console.log('rawContent length:', paper?.rawContent?.length || 0);
  
  const questions = await prisma.question.findMany({ 
    where: { paperId: 6 }, 
    orderBy: { questionNumber: 'asc' } 
  });
  console.log('\nQuestions for paper 6:', questions.length);
  for (const q of questions.slice(0, 5)) {
    console.log('  Q' + q.questionNumber + ': content=' + q.content.length + ' answer=' + (q.answer || '').length + ' analysis=' + (q.analysis || '').length);
  }
  
  // Check if there are duplicate questions (from re-split)
  const allQ = await prisma.question.count({ where: { paperId: 6 } });
  console.log('\nTotal questions for paper 6:', allQ);
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
