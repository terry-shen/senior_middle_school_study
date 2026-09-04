const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  if (!paper || !paper.parsedMarkdown) { console.log('No parsedMarkdown'); return; }
  
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Split result:', result.success, 'questions:', result.questions?.length);
  
  if (result.questions) {
    result.questions.forEach((q, i) => {
      const hasAns = q.correctAnswer ? 'Y' : 'N';
      const hasAnal = q.analysis ? 'Y' : 'N';
      const contentPreview = q.content?.substring(0, 80);
      console.log('Q' + (i+1) + ' (#' + q.questionNumber + '): content=' + q.content?.length + ' ans=' + hasAns + ' anal=' + hasAnal + ' type=' + q.questionType);
      console.log('  preview: ' + contentPreview);
    });
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
