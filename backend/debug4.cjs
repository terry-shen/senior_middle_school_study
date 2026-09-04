const { PrismaClient } = require('@prisma/client');
const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 } });
  console.log('parsedMarkdown length:', paper.parsedMarkdown?.length);
  console.log('rawContent length:', paper.rawContent?.length);
  
  // Call the actual function
  const result = await splitQuestionsFromMarkdown(paper.parsedMarkdown);
  console.log('\nsplitQuestionsFromMarkdown result:');
  console.log('  success:', result.success);
  console.log('  questions:', result.questions?.length);
  
  if (result.questions && result.questions.length > 0) {
    let withAns = 0, withAnalysis = 0;
    for (const q of result.questions) {
      if (q.correctAnswer) withAns++;
      if (q.analysis) withAnalysis++;
    }
    console.log('  with correctAnswer:', withAns);
    console.log('  with analysis:', withAnalysis);
    console.log('\n  Q1:', JSON.stringify(result.questions[0]).substring(0, 200));
  }
  
  // Check: is parsedMarkdown different from rawContent?
  console.log('\nparsedMarkdown === rawContent?', paper.parsedMarkdown === paper.rawContent);
  if (paper.parsedMarkdown !== paper.rawContent) {
    console.log('rawContent first 100 chars:', paper.rawContent?.substring(0, 100));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
