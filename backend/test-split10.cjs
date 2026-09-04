const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 10 } });
  console.log('parsedMarkdown length:', paper.parsedMarkdown?.length);
  console.log('rawContent length:', paper.rawContent?.length);
  
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Split result:', result.success, 'questions:', result.questions?.length);
  if (result.questions) {
    result.questions.forEach((q,i) => console.log('Q'+(i+1)+': num='+q.questionNumber+' content='+q.content?.length));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
