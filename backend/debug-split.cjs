const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  console.log('parsedMarkdown length:', paper.parsedMarkdown?.length);
  console.log('rawContent length:', paper.rawContent?.length);
  
  // Test splitQuestionsFromMarkdown directly
  const result = splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('Direct split result:', result.success, 'questions:', result.questions?.length);
  
  // Check what questions look like
  if (result.questions) {
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      console.log('Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length + ' ans=' + (q.correctAnswer?'Y':'N') + ' anal=' + (q.analysis?'Y':'N'));
    }
  }
  
  // Also check: does paper.rawContent equal parsedMarkdown?
  console.log('\nrawContent === parsedMarkdown?', paper.rawContent === paper.parsedMarkdown);
  if (paper.rawContent !== paper.parsedMarkdown) {
    console.log('rawContent first 200:', paper.rawContent?.substring(0, 200));
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
