const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Questions:', result.questions?.length);
  if (result.questions) {
    result.questions.forEach((q, i) => {
      console.log('Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length + ' ans=' + (q.correctAnswer?'Y':'N') + ' anal=' + (q.analysis?'Y':'N') + ' type=' + q.questionType);
      console.log('  preview: ' + q.content?.substring(0, 100));
      if (q.correctAnswer) console.log('  answer: ' + q.correctAnswer.substring(0, 60));
    });
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
