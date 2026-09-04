const { PrismaClient } = require('@prisma/client');
const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 } });
  const md = paper.parsedMarkdown;
  const result = await splitQuestionsFromMarkdown(md);
  console.log('Result keys:', Object.keys(result));
  console.log('questions type:', typeof result.questions);
  if (result.questions) {
    console.log('questions length:', result.questions.length);
    console.log('Q1 keys:', Object.keys(result.questions[0]));
    console.log('Q1:', JSON.stringify(result.questions[0]).substring(0, 500));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
