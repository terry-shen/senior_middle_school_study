const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Questions:', result.questions.length);
  result.questions.forEach(q => {
    console.log('Q' + q.questionNumber + ': content=' + (q.content?.length||0) + ' ans=' + (q.correctAnswer||'none').substring(0,15) + ' anal=' + (q.analysis?.length||0));
    if (q.content) console.log('  content: ' + q.content.substring(0, 80).replace(/\n/g, '\\n'));
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
