const { PrismaClient } = require('@prisma/client');
const { splitQuestionsFromPaper } = require('./dist/services/question-splitting-service');
const prisma = new PrismaClient();
async function main() {
  console.log('Calling splitQuestionsFromPaper(6)...');
  const result = await splitQuestionsFromPaper(6);
  console.log('Result:', result.success, 'questions:', result.questions?.length);
  if (result.questions) {
    let withAns = 0, withAnalysis = 0;
    for (const q of result.questions) {
      if (q.correctAnswer) withAns++;
      if (q.analysis) withAnalysis++;
    }
    console.log('With correctAnswer:', withAns);
    console.log('With analysis:', withAnalysis);
    console.log('\nQ1:', JSON.stringify(result.questions[0]).substring(0, 300));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
