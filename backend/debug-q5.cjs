const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  const md = paper.parsedMarkdown;
  const { autoTagQuestions, splitQuestionsByTags } = require('./dist/services/question-splitting-service');
  const tagged = autoTagQuestions(md);
  const result = splitQuestionsByTags(tagged);

  // Show Q5 content
  const q5 = result.questions.find(q => q.questionNumber === 5);
  console.log('Q5 content length:', q5.content.length);
  console.log('Q5 content (first 500):');
  console.log(q5.content.substring(0, 500));
  console.log('---');
  console.log('Q5 answer:', q5.correctAnswer);
  console.log('Q5 analysis:', q5.analysis?.substring(0, 100));

  const idx = q5.content.indexOf('【答案');
  console.log('【答案 index in Q5 content:', idx);
  const idx2 = q5.content.indexOf('【解析');
  console.log('【解析 index in Q5 content:', idx2);

  // Show Q18
  const q18 = result.questions.find(q => q.questionNumber === 18);
  console.log('\nQ18 content length:', q18.content?.length || 0);
  console.log('Q18 content (first 200):', q18.content?.substring(0, 200));
  console.log('Q18 answer:', q18.correctAnswer);
  console.log('Q18 analysis:', q18.analysis?.substring(0, 100));
}

main().then(() => prisma.$disconnect());
