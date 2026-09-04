const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true } });
  if (!paper || !paper.parsedMarkdown) { console.log('No paper #6'); return; }
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Split: success=' + result.success + ' questions=' + result.questions.length);
  result.questions.forEach(q => {
    const hasImg = q.content && q.content.includes('/uploads/');
    const hasAns = q.correctAnswer && q.correctAnswer.length > 0;
    const hasAna = q.analysis && q.analysis.length > 0;
    console.log('  Q' + q.questionNumber + ': content=' + (q.content||'').length + ' answer=' + (q.correctAnswer||'').length + ' analysis=' + (q.analysis||'').length + ' img=' + hasImg);
  });
  await prisma.$disconnect();
})();
